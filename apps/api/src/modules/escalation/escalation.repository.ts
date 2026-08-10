import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { priorityPatients } from '../../database/schema';

export interface PriorityPatientRow {
  id: string;
  sessionId: string | null;
  patientName: string;
  procedure: string;
  requestedBy: string;
  status: 'ok' | 'attn' | 'fail';
  llmSummary: string;
  outcome: string;
  durationSeconds: number;
  caseNotes: string;
}

export interface CreatePriorityPatientInput {
  sessionId: string;
  patientName: string;
  procedure: string;
  requestedBy: string;
  outcome: string;
  caseNotes: string;
}

@Injectable()
export class EscalationRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  /** `onConflictDoNothing` sobre el UNIQUE de session_id: la idempotencia vive en la base. */
  async create(input: CreatePriorityPatientInput): Promise<PriorityPatientRow | undefined> {
    const [row] = await this.db
      .insert(priorityPatients)
      .values({
        sessionId: input.sessionId,
        patientName: input.patientName,
        procedure: input.procedure,
        requestedBy: input.requestedBy,
        status: 'attn',
        llmSummary: '',
        outcome: input.outcome,
        durationSeconds: 0,
        caseNotes: input.caseNotes,
      })
      .onConflictDoNothing({ target: priorityPatients.sessionId })
      .returning();
    return row;
  }

  async findBySessionId(sessionId: string): Promise<PriorityPatientRow | undefined> {
    const [row] = await this.db
      .select()
      .from(priorityPatients)
      .where(eq(priorityPatients.sessionId, sessionId));
    return row;
  }

  async updateBySessionId(
    sessionId: string,
    patch: Partial<Pick<PriorityPatientRow, 'llmSummary' | 'outcome' | 'caseNotes' | 'durationSeconds' | 'status'>>,
  ): Promise<PriorityPatientRow | undefined> {
    const [row] = await this.db
      .update(priorityPatients)
      .set(patch)
      .where(eq(priorityPatients.sessionId, sessionId))
      .returning();
    return row;
  }
}
