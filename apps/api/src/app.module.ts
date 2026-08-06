import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { LlmModule } from './modules/llm/llm.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, LlmModule],
})
export class AppModule {}
