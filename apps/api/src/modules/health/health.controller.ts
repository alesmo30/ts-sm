import { Controller, Get } from '@nestjs/common';

import type { HealthResponseDto } from './health.dto';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }
}
