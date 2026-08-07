import { Logger } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import { ClientEventSchema, type ServerEvent } from '@ts-sm/shared';
import type { WebSocket } from 'ws';

@WebSocketGateway({ path: '/ws' })
export class ConversationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ConversationGateway.name);

  handleConnection(client: WebSocket): void {
    this.logger.log('Cliente conectado al gateway de conversación');
    client.on('error', (error) => {
      this.logger.error(`Error en socket: ${error.message}`);
    });
  }

  @SubscribeMessage('user_message')
  handleUserMessage(client: WebSocket, payload: unknown): void {
    const parsed = ClientEventSchema.safeParse(payload);

    if (!parsed.success) {
      this.emit(client, {
        type: 'error',
        message: `Evento inválido: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      });
      return;
    }

    this.emit(client, { type: 'error', message: 'no implementado' });
  }

  private emit(client: WebSocket, event: ServerEvent): void {
    client.send(JSON.stringify(event));
  }
}
