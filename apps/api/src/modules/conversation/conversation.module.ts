import { Module } from '@nestjs/common';

import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { SessionsModule } from '../sessions/sessions.module';
import { VoiceModule } from '../voice/voice.module';

import { ConversationController } from './conversation.controller';
import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';

@Module({
  imports: [LlmModule, SessionsModule, VoiceModule, KnowledgeModule],
  controllers: [ConversationController],
  providers: [ConversationGateway, ConversationService],
})
export class ConversationModule {}
