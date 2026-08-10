import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ReferenceType } from '@ts-sm/shared';

import { ChunkTranslator, TRANSLATION_CONCURRENCY, runWithConcurrency, slugify } from './chunk-translator';
import { chunkByParagraphs } from './chunker';
import { detectLanguage } from './detect-language';
import { ExtractionService } from './extractors';
import { KnowledgeRepository, type IngestJobRow, type NewChunk } from './knowledge.repository';

const MAX_CHUNK_CHARS = 1500;
const CHUNK_OVERLAP = 150;
const BODY_PREVIEW_CHARS = 500;

export type IngestInput =
  | { kind: 'text'; name: string; body: string }
  | { kind: 'file'; name: string; type: Exclude<ReferenceType, 'NOTA'>; buffer: Buffer; sizeBytes: number };

export interface KnowledgeUpdatedEvent {
  referenceName: string;
  kbVersion: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  // Cola de un job en vuelo a la vez: no compite por el TPM del proveedor de
  // LLM con el chat del paciente. Estado de instancia porque el provider es
  // singleton en Nest — sobrevive entre requests del mismo proceso.
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly extraction: ExtractionService,
    private readonly chunkTranslator: ChunkTranslator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async ingest(input: IngestInput): Promise<IngestJobRow> {
    const existing = await this.repository.findReferenceByName(input.name);
    const job = await this.repository.createJob(input.name);

    if (existing) {
      return (
        (await this.repository.updateJobStage(job.id, {
          error: `Ya existe un documento con el nombre "${input.name}".`,
        })) ?? job
      );
    }

    this.queue = this.queue.then(async () => {
      try {
        await this.run(job.id, input);
      } catch (error) {
        this.logger.error(`Ingesta ${job.id} falló: ${error instanceof Error ? error.message : String(error)}`);
        await this.repository.updateJobStage(job.id, {
          error: error instanceof Error ? error.message : 'Error desconocido durante la ingesta.',
        });
      }
    });

    return job;
  }

  private async run(jobId: string, input: IngestInput): Promise<void> {
    await this.repository.updateJobStage(jobId, { stage: 'Extrayendo texto', pct: 20 });

    const rawText =
      input.kind === 'text' ? input.body.trim() : await this.extraction.extract(input.type, input.buffer, input.name);

    if (!rawText) {
      throw new Error('No fue posible extraer texto del documento.');
    }

    await this.repository.updateJobStage(jobId, { stage: 'Fragmentando', pct: 40 });

    const rawChunks = chunkByParagraphs(rawText, MAX_CHUNK_CHARS, CHUNK_OVERLAP);
    if (rawChunks.length === 0) {
      throw new Error('El documento no produjo ningún fragmento.');
    }

    const lang = detectLanguage(rawText);
    const chunks: NewChunk[] = await this.buildChunks(input.name, rawChunks, lang);

    await this.repository.updateJobStage(jobId, { stage: 'Generando embeddings', pct: 80 });

    const type: 'PDF' | 'MD' | 'TXT' | 'JSON' | 'NOTA' = input.kind === 'text' ? 'NOTA' : input.type;
    const sizeBytes = input.kind === 'file' ? input.sizeBytes : null;
    const body = rawText.slice(0, BODY_PREVIEW_CHARS);

    const { reference, kbVersion } = await this.repository.createReferenceWithChunks({
      name: input.name,
      type,
      sizeBytes,
      body,
      origin: 'upload',
      chunks,
    });

    await this.repository.updateJobStage(jobId, { stage: 'Indexado', pct: 100, referenceId: reference.id });

    this.eventEmitter.emit('knowledge.updated', {
      referenceName: reference.name,
      kbVersion,
    } satisfies KnowledgeUpdatedEvent);
  }

  private async buildChunks(
    name: string,
    rawChunks: string[],
    lang: 'spanish' | 'english',
  ): Promise<NewChunk[]> {
    if (lang === 'spanish') {
      return rawChunks.map((text) => ({ text, sourceText: null, lang, translated: false }));
    }

    const docSlug = slugify(name);
    const translated: NewChunk[] = new Array(rawChunks.length);

    await runWithConcurrency(rawChunks, TRANSLATION_CONCURRENCY, async (text, index) => {
      const { translation } = await this.chunkTranslator.translate(docSlug, index, text);
      translated[index] = { text: translation, sourceText: text, lang, translated: true };
    });

    return translated;
  }
}
