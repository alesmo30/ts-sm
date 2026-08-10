import { Module } from '@nestjs/common';

import { EscalationModule } from '../escalation/escalation.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { SessionsModule } from '../sessions/sessions.module';
import { VoiceModule } from '../voice/voice.module';

import { ConversationController } from './conversation.controller';
import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';
import { InactivityCloserService } from './inactivity-closer.service';

@Module({
  imports: [LlmModule, SessionsModule, VoiceModule, KnowledgeModule, EscalationModule],
  controllers: [ConversationController],
  providers: [ConversationGateway, ConversationService, InactivityCloserService],
})
export class ConversationModule {}
