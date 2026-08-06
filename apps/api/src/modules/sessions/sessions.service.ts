import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateSessionInput,
  CreateTranscriptTurnInput,
  Session,
  SessionDetail,
  TranscriptTurn,
  UpdateSessionInput,
} from '@ts-sm/shared';

import { SessionsRepository, type SessionRow, type TranscriptTurnRow } from './sessions.repository';

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    code: row.code,
    date: row.date,
    time: row.time,
    patientName: row.patientName,
    procedure: row.procedure,
    status: row.status,
    kbVersion: row.kbVersion,
    summary: row.summary,
    structuredSummary: (row.structuredSummary as Session['structuredSummary']) ?? null,
    createdAt: row.createdAt,
  };
}

function toTurn(row: TranscriptTurnRow): TranscriptTurn {
  return {
    id: row.id,
    sessionId: row.sessionId,
    seq: row.seq,
    who: row.who,
    text: row.text,
    isVoice: row.isVoice,
    at: row.at,
    citations: (row.citations as TranscriptTurn['citations']) ?? [],
    kbVersion: row.kbVersion,
  };
}

@Injectable()
export class SessionsService {
  constructor(private readonly repository: SessionsRepository) {}

  async list(q?: string): Promise<Session[]> {
    const rows = await this.repository.findAll(q);
    return rows.map(toSession);
  }

  async getDetail(id: string): Promise<SessionDetail> {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new NotFoundException(`Sesión ${id} no encontrada`);
    }

    const turns = await this.repository.findTurnsBySessionId(id);
    return { ...toSession(session), turns: turns.map(toTurn) };
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const created = await this.repository.create(input);
    return toSession(created);
  }

  async addTurn(sessionId: string, input: CreateTranscriptTurnInput): Promise<TranscriptTurn> {
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Sesión ${sessionId} no encontrada`);
    }

    const created = await this.repository.createTurn(sessionId, input);
    return toTurn(created);
  }

  async update(id: string, patch: UpdateSessionInput): Promise<Session> {
    const updated = await this.repository.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Sesión ${id} no encontrada`);
    }

    return toSession(updated);
  }
}
