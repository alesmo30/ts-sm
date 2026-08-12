import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { priorityPatients, sessions } from '../../database/schema';

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
  sessionDate: string | null;
}

const priorityPatientColumns = {
  id: priorityPatients.id,
  sessionId: priorityPatients.sessionId,
  patientName: priorityPatients.patientName,
  procedure: priorityPatients.procedure,
  requestedBy: priorityPatients.requestedBy,
  status: priorityPatients.status,
  llmSummary: priorityPatients.llmSummary,
  outcome: priorityPatients.outcome,
  durationSeconds: priorityPatients.durationSeconds,
  caseNotes: priorityPatients.caseNotes,
  sessionDate: sessions.date,
};

@Injectable()
export class PatientsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findAll(): Promise<PriorityPatientRow[]> {
    return this.db
      .select(priorityPatientColumns)
      .from(priorityPatients)
      .leftJoin(sessions, eq(priorityPatients.sessionId, sessions.id));
  }

  async findById(id: string): Promise<PriorityPatientRow | undefined> {
    const [row] = await this.db
      .select(priorityPatientColumns)
      .from(priorityPatients)
      .leftJoin(sessions, eq(priorityPatients.sessionId, sessions.id))
      .where(eq(priorityPatients.id, id));
    return row;
  }
}
