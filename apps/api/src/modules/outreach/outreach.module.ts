import { Module } from '@nestjs/common';

import { LlmModule } from '../llm/llm.module';
import { PatientsModule } from '../patients/patients.module';

import { validateOutreachConfig } from './outreach.config';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';
import { OUTREACH_CONFIG } from './outreach.tokens';

@Module({
  imports: [LlmModule, PatientsModule],
  controllers: [OutreachController],
  providers: [
    OutreachService,
    {
      provide: OUTREACH_CONFIG,
      useFactory: () => validateOutreachConfig(process.env),
    },
  ],
})
export class OutreachModule {}
