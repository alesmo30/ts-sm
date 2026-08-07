import { Body, Controller, Get, Post } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { CompleteRequestSchema, type CompleteRequest } from './dto/complete.dto';
import { LlmService, type LlmHealth } from './llm.service';
import type { LlmCompletion } from './llm.types';
import type { LlmMetricsSnapshot } from './metrics';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('complete')
  complete(@Body(new ZodValidationPipe(CompleteRequestSchema)) body: CompleteRequest): Promise<LlmCompletion> {
    return this.llmService.complete(body.messages, body.options);
  }

  @Get('health')
  health(): LlmHealth {
    return this.llmService.health();
  }

  @Get('metrics')
  metrics(): LlmMetricsSnapshot {
    return this.llmService.metricsSnapshot();
  }
}
