import { Controller, Get } from '@nestjs/common';
import type { StatsCounts } from '@ts-sm/shared';

import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('counts')
  getCounts(): Promise<StatsCounts> {
    return this.statsService.getCounts();
  }
}
