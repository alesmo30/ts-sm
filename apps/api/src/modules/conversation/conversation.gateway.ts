import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ClientEventSchema, type ServerEvent } from '@ts-sm/shared';
import type { WebSocket, RawData } from 'ws';

import type { KnowledgeUpdatedEvent } from '../knowledge/ingestion.service';
import type { SttSession } from '../voice/voice.service';

import { ConversationService } from './conversation.service';

@WebSocketGateway({ path: '/ws' })
export class ConversationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ConversationGateway.name);
  private readonly sttSessions = new Map<WebSocket, SttSession>();
  // El POST de ingesta llega por HTTP, sin socket propio — este registro es
  // lo que permite que el separador de sistema aterrice en el hilo de un
  // paciente que no pidió nada. Set porque la misma sesión puede tener dos
  // pestañas abiertas (caso de la demo).
  private readonly socketsBySession = new Map<string, Set<WebSocket>>();
  private readonly sessionByClient = new Map<WebSocket, string>();
  // SPEC 13 — marca de Date.now() tomada al terminar de transcribir el
  // audio_end de este socket; el siguiente user_message del mismo cliente la
  // consume para medir endOfSpeechLatencyMs y la borra al leerla, así un
  // audio_end no puede alimentar dos turnos.
  private readonly audioEndByClient = new Map<WebSocket, number>();

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

  /** Idempotente: cualquier evento con sessionId puede ser la primera señal de este cliente (sesión resumida sin start_conversation). */
  private registerSocket(client: WebSocket, sessionId: string): void {
    if (!this.socketsBySession.has(sessionId)) {
      this.socketsBySession.set(sessionId, new Set());
    }
    this.socketsBySession.get(sessionId)?.add(client);
    this.sessionByClient.set(client, sessionId);
  }

  handleDisconnect(client: WebSocket): void {
    this.sttSessions.delete(client);
    this.audioEndByClient.delete(client);
    const sessionId = this.sessionByClient.get(client);
    if (sessionId) {
      this.socketsBySession.get(sessionId)?.delete(client);
      this.sessionByClient.delete(client);
    }
  }

  @OnEvent('knowledge.updated')
  async handleKnowledgeUpdated(event: KnowledgeUpdatedEvent): Promise<void> {
    const turns = await this.conversationService.createKnowledgeUpdateTurns(event.referenceName);

    for (const { sessionId, turn } of turns) {
      const sockets = this.socketsBySession.get(sessionId);
      if (!sockets) continue;
      for (const socket of sockets) {
        this.emit(socket, { type: 'knowledge_updated', turn, kbVersion: event.kbVersion });
      }
    }
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
    this.registerSocket(client, event.sessionId);

    // SPEC 13 — se consume y se borra en el mismo paso: un audio_end solo
    // puede alimentar el próximo user_message de este socket, nunca dos.
    const audioEndAt = this.audioEndByClient.get(client) ?? null;
    this.audioEndByClient.delete(client);

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
        audioEndAt,
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

    this.registerSocket(client, parsed.data.sessionId);

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

  @SubscribeMessage('join_session')
  handleJoinSession(client: WebSocket, payload: unknown): void {
    const parsed = ClientEventSchema.safeParse(payload);

    if (!parsed.success || parsed.data.type !== 'join_session') {
      this.emit(client, { type: 'error', message: 'Evento join_session inválido.' });
      return;
    }

    this.registerSocket(client, parsed.data.sessionId);
  }

  @SubscribeMessage('audio_start')
  async handleAudioStart(client: WebSocket, payload: unknown): Promise<void> {
    const parsed = ClientEventSchema.safeParse(payload);
    if (!parsed.success || parsed.data.type !== 'audio_start') {
      this.emit(client, { type: 'error', message: 'Evento audio_start inválido.' });
      return;
    }
    this.registerSocket(client, parsed.data.sessionId);

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

    // SPEC 13 — la marca se toma acá, después de transcribir, no al llegar el
    // frame de audio_end: es el instante desde el que el paciente queda
    // esperando respuesta, con el tramo de STT ya incluido.
    this.audioEndByClient.set(client, Date.now());

    // No se envía solo: el texto transcrito vuelve al cliente para que se
    // acumule en el composer (editable, combinable con más dictado o texto
    // escrito a mano). El envío real pasa siempre por user_message. El cliente
    // vuelve sttStatus a 'idle' al recibir stt_result — no hace falta un
    // evento aparte para eso.
    this.emit(client, { type: 'stt_result', text: transcript });
  }

  @SubscribeMessage('escalation_cancelled')
  async handleEscalationCancelled(client: WebSocket, payload: unknown): Promise<void> {
    const parsed = ClientEventSchema.safeParse(payload);
    if (!parsed.success || parsed.data.type !== 'escalation_cancelled') {
      this.emit(client, { type: 'error', message: 'Evento escalation_cancelled inválido.' });
      return;
    }

    await this.conversationService.cancelEscalation(parsed.data.sessionId);
  }

  private emit(client: WebSocket, event: ServerEvent): void {
    client.send(JSON.stringify(event));
  }
}
