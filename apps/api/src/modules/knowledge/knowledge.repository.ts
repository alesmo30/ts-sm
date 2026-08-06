import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { kbState, references } from '../../database/schema';

export interface ReferenceRow {
  id: string;
  name: string;
  type: 'PDF' | 'MD' | 'TXT' | 'JSON' | 'NOTA';
  addedAt: Date;
  sizeBytes: number | null;
  active: boolean;
  version: number;
  chunks: number;
  body: string;
}

@Injectable()
export class KnowledgeRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async findActiveReferences(): Promise<ReferenceRow[]> {
    return this.db.select().from(references).where(eq(references.active, true));
  }

  async getKbVersion(): Promise<number> {
    const [row] = await this.db.select({ version: kbState.version }).from(kbState);
    return row?.version ?? 1;
  }
}
