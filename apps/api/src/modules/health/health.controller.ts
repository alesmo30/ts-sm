import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@ts-sm/shared';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
