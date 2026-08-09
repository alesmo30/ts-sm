import { Module } from '@nestjs/common';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeRepository } from './knowledge.repository';
import { KnowledgeService } from './knowledge.service';
import { RetrievalService } from './retrieval.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeRepository, RetrievalService],
  exports: [RetrievalService],
})
export class KnowledgeModule {}
