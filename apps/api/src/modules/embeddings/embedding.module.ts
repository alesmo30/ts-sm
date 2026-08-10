import { Module } from '@nestjs/common';

import { EmbeddingClient } from './embedding.client';
import { type EmbeddingConfig, validateEmbeddingConfig } from './embedding.config';
import { EMBEDDING_CONFIG } from './embedding.tokens';

@Module({
  providers: [
    EmbeddingClient,
    {
      provide: EMBEDDING_CONFIG,
      useFactory: (): EmbeddingConfig => validateEmbeddingConfig(process.env),
    },
  ],
  exports: [EmbeddingClient],
})
export class EmbeddingModule {}
