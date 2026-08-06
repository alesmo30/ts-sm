import { Global, Module } from '@nestjs/common';
import type { Pool } from 'pg';

import { CONFIGURATION } from '../config/config.module';
import type { Configuration } from '../config/configuration';

import { createDrizzleClient, type DrizzleClient } from './drizzle.client';

export const DRIZZLE_CLIENT = Symbol('DRIZZLE_CLIENT');
export const PG_POOL = Symbol('PG_POOL');

const DRIZZLE_CONNECTION = Symbol('DRIZZLE_CONNECTION');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_CONNECTION,
      useFactory: (config: Configuration) => createDrizzleClient(config.databaseUrl),
      inject: [CONFIGURATION],
    },
    {
      provide: PG_POOL,
      useFactory: (connection: { pool: Pool; db: DrizzleClient }): Pool => connection.pool,
      inject: [DRIZZLE_CONNECTION],
    },
    {
      provide: DRIZZLE_CLIENT,
      useFactory: (connection: { pool: Pool; db: DrizzleClient }): DrizzleClient => connection.db,
      inject: [DRIZZLE_CONNECTION],
    },
  ],
  exports: [DRIZZLE_CLIENT, PG_POOL],
})
export class DatabaseModule {}
