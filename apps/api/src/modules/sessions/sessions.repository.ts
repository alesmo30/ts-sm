import { Inject, Injectable } from '@nestjs/common';
import type { CreateSessionInput, CreateTranscriptTurnInput, UpdateSessionInput } from '@ts-sm/shared';
import { and, asc, desc, eq, ilike, isNull, lt, or } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { kbState, sessions, transcripts } from '../../database/schema';

export interface SessionRow {
  id: string;
  code: string;
  date: string;
  time: string;
  patientName: string;
  procedure: string;
  status: 'ok' | 'attn' | 'fail';
  kbVersion: number;
  summary: string | null;
  structuredSummary: unknown;
  createdAt: Date;
  email: string;
  phone: string;
  closedAt: Date | null;
  lastActivityAt: Date;
  triageLevel: 'green' | 'yellow' | 'red';
  triageAreas: unknown;
}

export interface TranscriptTurnRow {
  id: string;
  sessionId: string;
  seq: number;
  who: 'patient' | 'assistant' | 'system';
  text: string;
  isVoice: boolean;
  at: Date;
  citations: unknown;
  kbVersion: number;
}

@Injectable()
export class SessionsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findAll(q?: string): Promise<SessionRow[]> {
    const where = q
      ? or(
          ilike(sessions.patientName, `%${q}%`),
          ilike(sessions.code, `%${q}%`),
          ilike(sessions.procedure, `%${q}%`),
        )
      : undefined;

    return this.db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.createdAt));
  }

  async findById(id: string): Promise<SessionRow | undefined> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.id, id));
    return row;
  }

  /** Sesiones vivas — closed_at IS NULL —, sin importar si tienen socket conectado ahora mismo. */
  async findOpenSessionIds(): Promise<string[]> {
    const rows = await this.db.select({ id: sessions.id }).from(sessions).where(isNull(sessions.closedAt));
    return rows.map((row) => row.id);
  }

  async findTurnsBySessionId(sessionId: string): Promise<TranscriptTurnRow[]> {
    return this.db
      .select()
      .from(transcripts)
      .where(eq(transcripts.sessionId, sessionId))
      .orderBy(asc(transcripts.seq));
  }

  async create(input: CreateSessionInput): Promise<SessionRow> {
    return this.db.transaction(async (tx) => {
      const lastCodeRows = await tx
        .select({ code: sessions.code })
        .from(sessions)
        .orderBy(desc(sessions.code))
        .limit(1);

      const nextNumber = lastCodeRows[0]
        ? Number(lastCodeRows[0].code.replace('SES-', '')) + 1
        : 4821;
      const code = `SES-${String(nextNumber).padStart(4, '0')}`;

      const kbVersionRows = await tx.select({ version: kbState.version }).from(kbState);
      const kbVersion = kbVersionRows[0]?.version ?? 1;

      const now = new Date();
      const [created] = await tx
        .insert(sessions)
        .values({
          code,
          date: now.toISOString().slice(0, 10),
          time: now.toISOString().slice(11, 16),
          patientName: input.patientName,
          procedure: input.procedure,
          status: 'ok',
          kbVersion,
          summary: null,
          structuredSummary: null,
          email: input.email,
          phone: input.phone,
        })
        .returning();

      return created;
    });
  }

  async createTurn(
    sessionId: string,
    input: CreateTranscriptTurnInput,
  ): Promise<TranscriptTurnRow> {
    return this.db.transaction(async (tx) => {
      const lastSeqRows = await tx
        .select({ seq: transcripts.seq })
        .from(transcripts)
        .where(eq(transcripts.sessionId, sessionId))
        .orderBy(desc(transcripts.seq))
        .limit(1);

      const seq = lastSeqRows[0] ? lastSeqRows[0].seq + 1 : 0;

      const kbVersionRows = await tx.select({ version: kbState.version }).from(kbState);
      const kbVersion = kbVersionRows[0]?.version ?? 1;

      const [created] = await tx
        .insert(transcripts)
        .values({
          sessionId,
          seq,
          who: input.who,
          text: input.text,
          isVoice: input.isVoice,
          citations: input.citations,
          kbVersion,
        })
        .returning();

      await tx.update(sessions).set({ lastActivityAt: new Date() }).where(eq(sessions.id, sessionId));

      return created;
    });
  }

  async findStaleOpenSessionIds(olderThan: Date): Promise<string[]> {
    const rows = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(isNull(sessions.closedAt), lt(sessions.lastActivityAt, olderThan)));
    return rows.map((row) => row.id);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async update(id: string, patch: UpdateSessionInput): Promise<SessionRow | undefined> {
    if (Object.keys(patch).length === 0) {
      return this.findById(id);
    }

    const [updated] = await this.db.update(sessions).set(patch).where(eq(sessions.id, id)).returning();

    return updated;
  }

  /** SPEC 10 — `triage_level`/`triage_areas` no salen al contrato (`UpdateSessionInput`),
   * así que se escriben por un camino aparte. `status` viaja junto porque el mapeo entre
   * los dos es fijo y se escribe en la misma transacción implícita del UPDATE. */
  async updateTriage(
    id: string,
    patch: { triageLevel: 'green' | 'yellow' | 'red'; triageAreas: unknown; status: 'ok' | 'attn' | 'fail' },
  ): Promise<void> {
    await this.db.update(sessions).set(patch).where(eq(sessions.id, id));
  }
}
