import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { priorityPatients, references, sessions } from '../../database/schema';

export interface StatsCountsRow {
  sessions: number;
  priorityPatients: number;
  references: number;
  uploads: number;
}

@Injectable()
export class StatsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getCounts(): Promise<StatsCountsRow> {
    const [[sessionsRow], [priorityRow], [referencesRow], [uploadsRow]] = await Promise.all([
      this.db.select({ value: count() }).from(sessions),
      this.db.select({ value: count() }).from(priorityPatients),
      this.db.select({ value: count() }).from(references).where(eq(references.active, true)),
      // Total subido a mano, activo o no — es un contador de tracking del
      // médico ("cuántos documentos he agregado"), no debe bajar solo porque
      // desactivó uno.
      this.db.select({ value: count() }).from(references).where(eq(references.origin, 'upload')),
    ]);

    return {
      sessions: sessionsRow?.value ?? 0,
      priorityPatients: priorityRow?.value ?? 0,
      references: referencesRow?.value ?? 0,
      uploads: uploadsRow?.value ?? 0,
    };
  }
}
