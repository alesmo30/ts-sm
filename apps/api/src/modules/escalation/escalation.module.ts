import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../embeddings/embedding.module';
import { LlmModule } from '../llm/llm.module';
import { SessionsModule } from '../sessions/sessions.module';

import { type EscalationConfig, validateEscalationConfig } from './escalation.config';
import { EscalationRepository } from './escalation.repository';
import { EscalationService } from './escalation.service';
import { ESCALATION_CONFIG } from './escalation.tokens';
import { RedFlagDetectorService } from './red-flag-detector.service';

@Module({
  imports: [LlmModule, SessionsModule, EmbeddingModule],
  providers: [
    EscalationService,
    EscalationRepository,
    RedFlagDetectorService,
    {
      provide: ESCALATION_CONFIG,
      useFactory: (): EscalationConfig => validateEscalationConfig(process.env),
    },
  ],
  exports: [EscalationService, RedFlagDetectorService],
})
export class EscalationModule {}
