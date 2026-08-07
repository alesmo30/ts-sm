import { Injectable } from '@nestjs/common';
import type { StatsCounts } from '@ts-sm/shared';

import { StatsRepository } from './stats.repository';

@Injectable()
export class StatsService {
  constructor(private readonly repository: StatsRepository) {}

  getCounts(): Promise<StatsCounts> {
    return this.repository.getCounts();
  }
}
