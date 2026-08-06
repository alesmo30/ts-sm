import { Controller, Get } from '@nestjs/common';
import type { KbState, Reference } from '@ts-sm/shared';

import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('references')
  listReferences(): Promise<Reference[]> {
    return this.knowledgeService.listActiveReferences();
  }

  @Get('state')
  getState(): Promise<KbState> {
    return this.knowledgeService.getState();
  }
}
