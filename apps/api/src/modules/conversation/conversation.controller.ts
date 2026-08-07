import { Controller, Param, Post } from '@nestjs/common';
import type { Session } from '@ts-sm/shared';

import { ConversationService } from './conversation.service';

@Controller('sessions')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post(':id/close')
  close(@Param('id') id: string): Promise<Session> {
    return this.conversationService.closeSession(id);
  }
}
