import type { Env } from './env.schema';

export interface Configuration {
  nodeEnv: Env['NODE_ENV'];
  port: number;
  databaseUrl: string;
}

export function buildConfiguration(env: Env): Configuration {
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
  };
}
