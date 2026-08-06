import { Global, Module } from '@nestjs/common';

import { buildConfiguration, type Configuration } from './configuration';
import { validateEnv } from './env.schema';

export const CONFIGURATION = Symbol('CONFIGURATION');

@Global()
@Module({
  providers: [
    {
      provide: CONFIGURATION,
      useFactory: (): Configuration => buildConfiguration(validateEnv(process.env)),
    },
  ],
  exports: [CONFIGURATION],
})
export class ConfigModule {}
