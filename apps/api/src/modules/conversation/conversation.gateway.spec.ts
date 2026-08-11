import type { WebSocket } from 'ws';

import type { SttSession } from '../voice/voice.service';

import { ConversationGateway } from './conversation.gateway';
import { ConversationService } from './conversation.service';

const SESSION_ID = '11111111-1111-1111-1111-111111111111';

function fakeClient(): WebSocket {
  return {
    send: jest.fn(),
    on: jest.fn(),
  } as unknown as WebSocket;
}

function fakeConversationService() {
  return {
    handleUserMessage: jest.fn(() => Promise.resolve(false)),
    startVoiceInput: jest.fn(),
    cancelEscalation: jest.fn(),
  } as unknown as ConversationService;
}

function fakeSttSession(transcript: string | null): SttSession {
  return {
    push: jest.fn(),
    finish: jest.fn(() => Promise.resolve(transcript)),
  } as unknown as SttSession;
}

describe('ConversationGateway — correlación de audio_end (SPEC 13)', () => {
  it('un audio_end con transcripción válida seguido de user_message pasa un audioEndAt no nulo', async () => {
    const conversationService = fakeConversationService();
    const gateway = new ConversationGateway(conversationService);
    const client = fakeClient();

    (gateway as unknown as { sttSessions: Map<WebSocket, SttSession> }).sttSessions.set(
      client,
      fakeSttSession('hola doctor'),
    );

    await gateway.handleAudioEnd(client, { type: 'audio_end', sessionId: SESSION_ID });
    await gateway.handleUserMessage(client, { type: 'user_message', sessionId: SESSION_ID, text: 'hola doctor', isVoice: true });

    expect(conversationService.handleUserMessage).toHaveBeenCalledTimes(1);
    const args = (conversationService.handleUserMessage as jest.Mock).mock.calls[0];
    expect(args[5]).not.toBeNull();
    expect(typeof args[5]).toBe('number');
  });

  it('un user_message escrito sin audio_end previo pasa audioEndAt null', async () => {
    const conversationService = fakeConversationService();
    const gateway = new ConversationGateway(conversationService);
    const client = fakeClient();

    await gateway.handleUserMessage(client, { type: 'user_message', sessionId: SESSION_ID, text: 'hola', isVoice: false });

    const args = (conversationService.handleUserMessage as jest.Mock).mock.calls[0];
    expect(args[5]).toBeNull();
  });

  it('dos user_message seguidos tras un solo audio_end dejan el segundo en null', async () => {
    const conversationService = fakeConversationService();
    const gateway = new ConversationGateway(conversationService);
    const client = fakeClient();

    (gateway as unknown as { sttSessions: Map<WebSocket, SttSession> }).sttSessions.set(
      client,
      fakeSttSession('hola doctor'),
    );

    await gateway.handleAudioEnd(client, { type: 'audio_end', sessionId: SESSION_ID });
    await gateway.handleUserMessage(client, { type: 'user_message', sessionId: SESSION_ID, text: 'hola doctor', isVoice: true });
    await gateway.handleUserMessage(client, { type: 'user_message', sessionId: SESSION_ID, text: 'otra vez', isVoice: false });

    const calls = (conversationService.handleUserMessage as jest.Mock).mock.calls;
    expect(calls[0][5]).not.toBeNull();
    expect(calls[1][5]).toBeNull();
  });

  it('un audio_end sin transcripción (fallo de STT) no deja marca para el siguiente user_message', async () => {
    const conversationService = fakeConversationService();
    const gateway = new ConversationGateway(conversationService);
    const client = fakeClient();

    (gateway as unknown as { sttSessions: Map<WebSocket, SttSession> }).sttSessions.set(client, fakeSttSession(null));

    await gateway.handleAudioEnd(client, { type: 'audio_end', sessionId: SESSION_ID });
    await gateway.handleUserMessage(client, { type: 'user_message', sessionId: SESSION_ID, text: 'texto escrito', isVoice: false });

    const args = (conversationService.handleUserMessage as jest.Mock).mock.calls[0];
    expect(args[5]).toBeNull();
  });

  it('handleDisconnect borra la marca de audio_end pendiente del socket', async () => {
    const conversationService = fakeConversationService();
    const gateway = new ConversationGateway(conversationService);
    const client = fakeClient();

    (gateway as unknown as { sttSessions: Map<WebSocket, SttSession> }).sttSessions.set(
      client,
      fakeSttSession('hola doctor'),
    );
    await gateway.handleAudioEnd(client, { type: 'audio_end', sessionId: SESSION_ID });

    const audioEndByClient = (gateway as unknown as { audioEndByClient: Map<WebSocket, number> }).audioEndByClient;
    expect(audioEndByClient.has(client)).toBe(true);

    gateway.handleDisconnect(client);

    expect(audioEndByClient.has(client)).toBe(false);
  });
});
