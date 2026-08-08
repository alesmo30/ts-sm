import { Logger } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ClientEventSchema, type ServerEvent } from '@ts-sm/shared';
import type { WebSocket, RawData } from 'ws';

import type { SttSession } from '../voice/voice.service';

import { ConversationService } from './conversation.service';

@WebSocketGateway({ path: '/ws' })
export class ConversationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ConversationGateway.name);
  private readonly sttSessions = new Map<WebSocket, SttSession>();

  constructor(private readonly conversationService: ConversationService) {}

  handleConnection(client: WebSocket): void {
    this.logger.log('Cliente conectado al gateway de conversación');
    client.on('error', (error) => {
      this.logger.error(`Error en socket: ${error.message}`);
    });
    // El WsAdapter de Nest solo entiende el envelope JSON {event, data} de @SubscribeMessage.
    // Los frames binarios (audio) se bifurcan acá antes de llegar a ese parser.
    client.on('message', (raw: RawData, isBinary: boolean) => {
      if (!isBinary) return;
      const session = this.sttSessions.get(client);
      if (!session) {
        this.logger.warn('Frame de audio recibido sin audio_start previo, descartado');
        return;
      }
      session.push(Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer));
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.sttSessions.delete(client);
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
    if (event.type !== 'user_message') return;

    try {
      // El agente responde en voz aunque el paciente haya escrito: emitAudio se
      // pasa siempre, no solo desde el flujo de audio_end. isVoice viaja en el
      // propio evento — el paciente pudo haber dictado parte del texto y
      // luego editarlo o completarlo a mano antes de enviarlo (acumulación
      // estilo Wispr Flow, ver decisión en specs/06-capa-de-voz.md).
      await this.conversationService.handleUserMessage(
        event.sessionId,
        event.text,
        event.isVoice,
        (serverEvent) => this.emit(client, serverEvent),
        (chunk) => client.send(chunk),
      );
    } catch (error) {
      this.logger.error(`Fallo no controlado procesando user_message: ${error instanceof Error ? error.message : String(error)}`);
      this.emit(client, { type: 'error', message: 'Ocurrió un error inesperado. Intenta de nuevo.' });
    }
  }

  @SubscribeMessage('start_conversation')
  async handleStartConversation(client: WebSocket, payload: unknown): Promise<void> {
    const parsed = ClientEventSchema.safeParse(payload);

    if (!parsed.success || parsed.data.type !== 'start_conversation') {
      this.emit(client, { type: 'error', message: 'Evento start_conversation inválido.' });
      return;
    }

    try {
      await this.conversationService.startConversation(
        parsed.data.sessionId,
        (serverEvent) => this.emit(client, serverEvent),
        (chunk) => client.send(chunk),
      );
    } catch (error) {
      this.logger.error(`Fallo no controlado procesando start_conversation: ${error instanceof Error ? error.message : String(error)}`);
      this.emit(client, { type: 'error', message: 'Ocurrió un error inesperado. Intenta de nuevo.' });
    }
  }

  @SubscribeMessage('audio_start')
  async handleAudioStart(client: WebSocket, payload: unknown): Promise<void> {
    const parsed = ClientEventSchema.safeParse(payload);
    if (!parsed.success || parsed.data.type !== 'audio_start') {
      this.emit(client, { type: 'error', message: 'Evento audio_start inválido.' });
      return;
    }

    try {
      const session = await this.conversationService.startVoiceInput();
      this.sttSessions.set(client, session);
      this.emit(client, { type: 'stt_status', state: 'listening' });
    } catch (error) {
      this.logger.error(`No fue posible abrir la sesión de STT: ${error instanceof Error ? error.message : String(error)}`);
      this.emit(client, { type: 'stt_status', state: 'failed', message: 'No fue posible activar el micrófono. Intenta de nuevo.' });
    }
  }

  @SubscribeMessage('audio_end')
  async handleAudioEnd(client: WebSocket, payload: unknown): Promise<void> {
    const parsed = ClientEventSchema.safeParse(payload);
    if (!parsed.success || parsed.data.type !== 'audio_end') {
      this.emit(client, { type: 'error', message: 'Evento audio_end inválido.' });
      return;
    }

    const session = this.sttSessions.get(client);
    this.sttSessions.delete(client);

    if (!session) {
      this.emit(client, { type: 'stt_status', state: 'failed', message: 'No había una grabación activa.' });
      return;
    }

    this.emit(client, { type: 'stt_status', state: 'transcribing' });
    const transcript = await session.finish();

    if (!transcript) {
      this.emit(client, { type: 'stt_status', state: 'failed', message: 'No se entendió nada. Intenta de nuevo.' });
      return;
    }

    // No se envía solo: el texto transcrito vuelve al cliente para que se
    // acumule en el composer (editable, combinable con más dictado o texto
    // escrito a mano). El envío real pasa siempre por user_message. El cliente
    // vuelve sttStatus a 'idle' al recibir stt_result — no hace falta un
    // evento aparte para eso.
    this.emit(client, { type: 'stt_result', text: transcript });
  }

  private emit(client: WebSocket, event: ServerEvent): void {
    client.send(JSON.stringify(event));
  }
}
