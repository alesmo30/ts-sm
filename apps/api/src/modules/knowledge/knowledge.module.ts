import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../embeddings/embedding.module';
import { LlmModule } from '../llm/llm.module';

import { ChunkTranslator } from './chunk-translator';
import { type CitationRelevanceConfig, validateCitationRelevanceConfig } from './citation-relevance.config';
import { CitationRelevanceService } from './citation-relevance.service';
import { CITATION_RELEVANCE_CONFIG } from './citation-relevance.tokens';
import { ExtractionService, JsonExtractor } from './extractors';
import { IngestionService } from './ingestion.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeRepository } from './knowledge.repository';
import { KnowledgeService } from './knowledge.service';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [LlmModule, EmbeddingModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    KnowledgeRepository,
    RetrievalService,
    CitationRelevanceService,
    {
      provide: CITATION_RELEVANCE_CONFIG,
      useFactory: (): CitationRelevanceConfig => validateCitationRelevanceConfig(process.env),
    },
    ExtractionService,
    JsonExtractor,
    ChunkTranslator,
    IngestionService,
  ],
  exports: [RetrievalService, CitationRelevanceService, IngestionService, KnowledgeRepository],
})
export class KnowledgeModule {}
