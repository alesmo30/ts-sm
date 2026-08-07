import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { priorityPatients, references, sessions } from '../../database/schema';

export interface StatsCountsRow {
  sessions: number;
  priorityPatients: number;
  references: number;
}

@Injectable()
export class StatsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async getCounts(): Promise<StatsCountsRow> {
    const [[sessionsRow], [priorityRow], [referencesRow]] = await Promise.all([
      this.db.select({ value: count() }).from(sessions),
      this.db.select({ value: count() }).from(priorityPatients),
      this.db.select({ value: count() }).from(references).where(eq(references.active, true)),
    ]);

    return {
      sessions: sessionsRow?.value ?? 0,
      priorityPatients: priorityRow?.value ?? 0,
      references: referencesRow?.value ?? 0,
    };
  }
}
