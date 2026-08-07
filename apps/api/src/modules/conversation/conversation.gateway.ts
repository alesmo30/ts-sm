import { Logger } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import { ClientEventSchema, type ServerEvent } from '@ts-sm/shared';
import type { WebSocket } from 'ws';

import { ConversationService } from './conversation.service';

@WebSocketGateway({ path: '/ws' })
export class ConversationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ConversationGateway.name);

  constructor(private readonly conversationService: ConversationService) {}

  handleConnection(client: WebSocket): void {
    this.logger.log('Cliente conectado al gateway de conversación');
    client.on('error', (error) => {
      this.logger.error(`Error en socket: ${error.message}`);
    });
  }

  @SubscribeMessage('user_message')
  async handleUserMessage(client: WebSocket, payload: unknown): Promise<void> {
    const parsed = ClientEventSchema.safeParse(payload);

    if (!parsed.success) {
      this.emit(client, {
        type: 'error',
        message: `Evento inválido: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      });
      return;
    }

    const event = parsed.data;

    try {
      await this.conversationService.handleUserMessage(event.sessionId, event.text, (serverEvent) => {
        this.emit(client, serverEvent);
      });
    } catch (error) {
      this.logger.error(`Fallo no controlado procesando user_message: ${error instanceof Error ? error.message : String(error)}`);
      this.emit(client, { type: 'error', message: 'Ocurrió un error inesperado. Intenta de nuevo.' });
    }
  }

  private emit(client: WebSocket, event: ServerEvent): void {
    client.send(JSON.stringify(event));
  }
}
