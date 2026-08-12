import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { HealthModule } from './modules/health/health.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { LlmModule } from './modules/llm/llm.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StatsModule } from './modules/stats/stats.module';
import { VoiceModule } from './modules/voice/voice.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ConfigModule,
    DatabaseModule,
    HealthModule,
    LlmModule,
    MetricsModule,
    VoiceModule,
    SessionsModule,
    PatientsModule,
    OutreachModule,
    KnowledgeModule,
    ConversationModule,
    StatsModule,
  ],
})
export class AppModule {}
