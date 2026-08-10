import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateReferenceTextSchema,
  UpdateReferenceActiveSchema,
  type IngestJob,
  type KbState,
  type Reference,
  type ReferenceOrigin,
  type UpdateReferenceActiveInput,
} from '@ts-sm/shared';
import { memoryStorage } from 'multer';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('references')
  listReferences(
    @Query('origin') origin?: ReferenceOrigin,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<Reference[]> {
    return this.knowledgeService.listReferences({ origin, includeInactive: includeInactive === 'true' });
  }

  @Get('state')
  getState(): Promise<KbState> {
    return this.knowledgeService.getState();
  }

  @Post('references')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createReference(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ): Promise<IngestJob> {
    if (file) {
      return this.knowledgeService.createFromFile(file);
    }

    const parsed = CreateReferenceTextSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validación fallida',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }

    return this.knowledgeService.createFromText(parsed.data);
  }

  @Patch('references/:id')
  setActive(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateReferenceActiveSchema)) body: UpdateReferenceActiveInput,
  ): Promise<Reference> {
    return this.knowledgeService.setActive(id, body.active);
  }

  @Get('jobs')
  getOpenJobs(): Promise<IngestJob[]> {
    return this.knowledgeService.getOpenJobs();
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string): Promise<IngestJob> {
    return this.knowledgeService.getJob(id);
  }
}
