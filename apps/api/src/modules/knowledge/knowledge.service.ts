import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateReferenceTextInput,
  IngestJob,
  KbState,
  Reference,
  ReferenceOrigin,
  ReferenceType,
} from '@ts-sm/shared';

import { IngestionService } from './ingestion.service';
import { KnowledgeRepository, type IngestJobRow, type ReferenceRow } from './knowledge.repository';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EXTENSION_TO_TYPE: Record<string, Exclude<ReferenceType, 'NOTA'>> = {
  '.pdf': 'PDF',
  '.md': 'MD',
  '.txt': 'TXT',
  '.json': 'JSON',
};

export interface UploadedFileInput {
  originalname: string;
  size: number;
  buffer: Buffer;
}

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
    origin: row.origin,
  };
}

function toIngestJob(row: IngestJobRow): IngestJob {
  return {
    id: row.id,
    referenceId: row.referenceId,
    fileName: row.fileName,
    stage: row.stage,
    pct: row.pct,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly ingestionService: IngestionService,
  ) {}

  async listReferences(filter: { origin?: ReferenceOrigin; includeInactive?: boolean } = {}): Promise<Reference[]> {
    const rows = await this.repository.findReferences({
      origin: filter.origin,
      includeInactive: filter.includeInactive ?? false,
    });
    return rows.map(toReference);
  }

  async listActiveReferences(): Promise<Reference[]> {
    const rows = await this.repository.findActiveReferences();
    return rows.map(toReference);
  }

  async getState(): Promise<KbState> {
    const version = await this.repository.getKbVersion();
    return { version };
  }

  async createFromText(input: CreateReferenceTextInput): Promise<IngestJob> {
    const job = await this.ingestionService.ingest({ kind: 'text', name: input.name, body: input.body });
    return toIngestJob(job);
  }

  async createFromFile(file: UploadedFileInput): Promise<IngestJob> {
    const extension = extensionOf(file.originalname);
    const type = EXTENSION_TO_TYPE[extension];

    if (!type) {
      throw new BadRequestException(
        `Tipo de archivo no aceptado: "${extension || file.originalname}". Solo .pdf, .md, .txt o .json.`,
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('El archivo supera el máximo de 10 MB.');
    }

    const job = await this.ingestionService.ingest({
      kind: 'file',
      name: file.originalname,
      type,
      buffer: file.buffer,
      sizeBytes: file.size,
    });
    return toIngestJob(job);
  }

  async setActive(id: string, active: boolean): Promise<Reference> {
    const result = await this.repository.setReferenceActive(id, active);
    if (!result) {
      throw new NotFoundException(`Referencia ${id} no encontrada.`);
    }
    return toReference(result.reference);
  }

  async getJob(id: string): Promise<IngestJob> {
    const job = await this.repository.findJob(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} no encontrado.`);
    }
    return toIngestJob(job);
  }

  async getOpenJobs(): Promise<IngestJob[]> {
    const jobs = await this.repository.findOpenJobs();
    return jobs.map(toIngestJob);
  }
}
