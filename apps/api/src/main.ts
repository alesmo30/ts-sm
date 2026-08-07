import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CONFIGURATION } from './config/config.module';
import type { Configuration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useWebSocketAdapter(new WsAdapter(app));

  const { port } = app.get<Configuration>(CONFIGURATION);
  await app.listen(port);

  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  Logger.error('Falló el arranque de la API', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
