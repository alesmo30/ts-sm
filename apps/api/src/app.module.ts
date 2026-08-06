import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { LlmModule } from './modules/llm/llm.module';
import { SessionsModule } from './modules/sessions/sessions.module';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule, LlmModule, SessionsModule],
})
export class AppModule {}
