import { Module } from '@nestjs/common';

import { PatientsController } from './patients.controller';
import { PatientsRepository } from './patients.repository';
import { PatientsService } from './patients.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
  exports: [PatientsService],
})
export class PatientsModule {}
