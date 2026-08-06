import { Injectable } from '@nestjs/common';
import type { KbState, Reference } from '@ts-sm/shared';

import { KnowledgeRepository, type ReferenceRow } from './knowledge.repository';

function toReference(row: ReferenceRow): Reference {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    addedAt: row.addedAt,
    sizeBytes: row.sizeBytes,
    active: row.active,
    version: row.version,
    chunks: row.chunks,
    body: row.body,
  };
}

@Injectable()
export class KnowledgeService {
  constructor(private readonly repository: KnowledgeRepository) {}

  async listActiveReferences(): Promise<Reference[]> {
    const rows = await this.repository.findActiveReferences();
    return rows.map(toReference);
  }

  async getState(): Promise<KbState> {
    const version = await this.repository.getKbVersion();
    return { version };
  }
}
