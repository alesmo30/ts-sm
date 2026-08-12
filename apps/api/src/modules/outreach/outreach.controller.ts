import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  GenerateOutreachDraftSchema,
  SendOutreachEmailSchema,
  StartOutreachCallSchema,
  type GenerateOutreachDraftInput,
  type OutreachDraft,
  type OutreachSendResult,
  type SendOutreachEmailInput,
  type StartOutreachCallInput,
} from '@ts-sm/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Post('draft')
  @HttpCode(HttpStatus.OK)
  draft(
    @Body(new ZodValidationPipe(GenerateOutreachDraftSchema)) body: GenerateOutreachDraftInput,
  ): Promise<OutreachDraft> {
    return this.outreachService.generateDraft(body.patientId);
  }

  @Post('email')
  @HttpCode(HttpStatus.OK)
  email(@Body(new ZodValidationPipe(SendOutreachEmailSchema)) body: SendOutreachEmailInput): Promise<OutreachSendResult> {
    return this.outreachService.sendEmail(body);
  }

  @Post('call')
  @HttpCode(HttpStatus.OK)
  call(@Body(new ZodValidationPipe(StartOutreachCallSchema)) body: StartOutreachCallInput): Promise<OutreachSendResult> {
    return this.outreachService.startCall(body);
  }
}
