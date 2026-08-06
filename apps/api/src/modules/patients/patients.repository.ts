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

@Injectable()
export class PatientsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findAll(): Promise<PriorityPatientRow[]> {
    return this.db.select().from(priorityPatients);
  }

  async findById(id: string): Promise<PriorityPatientRow | undefined> {
    const [row] = await this.db.select().from(priorityPatients).where(eq(priorityPatients.id, id));
    return row;
  }
}
