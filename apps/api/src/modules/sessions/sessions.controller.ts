import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type {
  CreateSessionInput,
  CreateTranscriptTurnInput,
  Session,
  SessionDetail,
  TranscriptTurn,
  UpdateSessionInput,
} from '@ts-sm/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { CreateSessionSchema, CreateTranscriptTurnSchema, UpdateSessionSchema } from './dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) { }

  @Get()
  list(@Query('q') q?: string): Promise<Session[]> {
    return this.sessionsService.list(q);
  }

  @Get(':id')
  getDetail(@Param('id') id: string): Promise<SessionDetail> {
    return this.sessionsService.getDetail(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateSessionSchema)) body: CreateSessionInput,
  ): Promise<Session> {
    return this.sessionsService.create(body);
  }

  @Post(':id/turns')
  addTurn(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateTranscriptTurnSchema)) body: CreateTranscriptTurnInput,
  ): Promise<TranscriptTurn> {
    return this.sessionsService.addTurn(id, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSessionSchema)) body: UpdateSessionInput,
  ): Promise<Session> {
    return this.sessionsService.update(id, body);
  }
}
