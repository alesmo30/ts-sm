import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SessionsService } from '../sessions/sessions.service';

import { ConversationService } from './conversation.service';

// Constante única en el servidor: es la ventana de inactividad tanto para
// cerrar por falta de turnos como para tolerar una desconexión de WebSocket
// (una recarga desconecta; no debe perder la conversación).
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class InactivityCloserService {
  private readonly logger = new Logger(InactivityCloserService.name);

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly conversationService: ConversationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async closeStaleSessions(): Promise<void> {
    const threshold = new Date(Date.now() - INACTIVITY_TIMEOUT_MS);
    const staleSessionIds = await this.sessionsService.listStaleOpenSessionIds(threshold);

    for (const sessionId of staleSessionIds) {
      try {
        await this.conversationService.closeSession(sessionId);
        this.logger.log(`Sesión ${sessionId} cerrada por inactividad`);
      } catch (error) {
        this.logger.error(
          `No fue posible cerrar por inactividad la sesión ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
