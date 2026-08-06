import { Controller, Get, Param } from '@nestjs/common';
import type { PriorityPatient } from '@ts-sm/shared';

import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('priority')
  list(): Promise<PriorityPatient[]> {
    return this.patientsService.list();
  }

  @Get('priority/:id')
  getById(@Param('id') id: string): Promise<PriorityPatient> {
    return this.patientsService.getById(id);
  }
}
