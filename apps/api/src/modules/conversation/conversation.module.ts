import { Module } from '@nestjs/common';

import { LlmModule } from '../llm/llm.module';
import { SessionsModule } from '../sessions/sessions.module';

import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';

@Module({
  imports: [LlmModule, SessionsModule],
  providers: [ConversationGateway, ConversationService],
})
export class ConversationModule {}
