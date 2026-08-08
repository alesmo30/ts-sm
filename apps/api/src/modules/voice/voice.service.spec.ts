import type { VoiceConfig } from './voice.config';
import { VoiceMetricsService } from './voice.metrics';
import { PhraseSegmenter, VoiceService } from './voice.service';

const connectMock = jest.fn();
const generateMock = jest.fn();

jest.mock('@deepgram/sdk', () => ({
  DeepgramClient: jest.fn().mockImplementation(() => ({
    listen: { v1: { connect: connectMock } },
    speak: { v1: { audio: { generate: generateMock } } },
  })),
}));

function fakeConfig(overrides: Partial<VoiceConfig> = {}): VoiceConfig {
  return {
    provider: 'deepgram',
    deepgramApiKey: 'test-key',
    sttModel: 'nova-3',
    ttsModel: 'aura-2-celeste-es',
    ...overrides,
  };
}

describe('PhraseSegmenter', () => {
  it('libera una frase completa al cruzar el mínimo de caracteres y un signo de cierre', () => {
    const segmenter = new PhraseSegmenter();
    const phrases = segmenter.push('Todo va bien con tu recuperación. ¿Cómo te sientes hoy en la mañana?');
    expect(phrases).toEqual(['Todo va bien con tu recuperación.', '¿Cómo te sientes hoy en la mañana?']);
  });

  it('no libera fragmentos por debajo del mínimo de caracteres hasta encontrar el próximo corte', () => {
    const segmenter = new PhraseSegmenter();
    const first = segmenter.push('Sí. Puedes tomar tu medicamento habitual sin problema.');
    expect(first).toEqual(['Sí. Puedes tomar tu medicamento habitual sin problema.']);
  });

  it('flush() sintetiza el resto sin puntuación al cerrar el stream', () => {
    const segmenter = new PhraseSegmenter();
    segmenter.push('Puedes tomar tu medicamento sin problema');
    expect(segmenter.flush()).toBe('Puedes tomar tu medicamento sin problema');
  });

  it('flush() devuelve null si no quedó texto pendiente', () => {
    const segmenter = new PhraseSegmenter();
    segmenter.push('Todo va bien con tu recuperación.');
    expect(segmenter.flush()).toBeNull();
  });
});

describe('VoiceService', () => {
  beforeEach(() => {
    connectMock.mockReset();
    generateMock.mockReset();
  });

  describe('startTranscription', () => {
    function fakeSocket() {
      const handlers: Record<string, (arg?: unknown) => void> = {};
      return {
        readyState: 1,
        on: jest.fn((event: string, cb: (arg?: unknown) => void) => {
          handlers[event] = cb;
        }),
        connect: jest.fn(),
        waitForOpen: jest.fn().mockResolvedValue(undefined),
        sendMedia: jest.fn(),
        sendCloseStream: jest.fn(),
        emit: (event: string, arg?: unknown) => handlers[event]?.(arg),
      };
    }

    it('pasa los keyterms clínicos en las opciones de conexión', async () => {
      const socket = fakeSocket();
      connectMock.mockResolvedValue(socket);
      const metrics = new VoiceMetricsService();
      const service = new VoiceService(fakeConfig(), metrics);

      await service.startTranscription();

      expect(connectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'nova-3',
          language: 'es',
          keyterm: expect.arrayContaining(['dolor postoperatorio', 'sutura']),
        }),
      );
    });

    it('resuelve con el transcript final concatenado de los resultados is_final', async () => {
      const socket = fakeSocket();
      connectMock.mockResolvedValue(socket);
      const metrics = new VoiceMetricsService();
      const service = new VoiceService(fakeConfig(), metrics);

      const session = await service.startTranscription();
      socket.emit('message', {
        type: 'Results',
        is_final: true,
        channel: { alternatives: [{ transcript: 'Tengo dolor en la incisión' }] },
      });
      socket.emit('close');

      const result = await session.finish();
      expect(result).toBe('Tengo dolor en la incisión');
      expect(metrics.getSnapshot().totalSttCalls).toBe(1);
      expect(metrics.getSnapshot().recent[0].ok).toBe(true);
    });

    it('un error del socket resuelve null y queda registrado con ok:false', async () => {
      const socket = fakeSocket();
      connectMock.mockResolvedValue(socket);
      const metrics = new VoiceMetricsService();
      const service = new VoiceService(fakeConfig(), metrics);

      const session = await service.startTranscription();
      socket.emit('error', new Error('boom'));

      const result = await session.finish();
      expect(result).toBeNull();
      expect(metrics.getSnapshot().recent[0].ok).toBe(false);
    });
  });

  describe('speak', () => {
    it('sintetiza el texto y registra la métrica de tts', async () => {
      const fakeBytes = new Uint8Array([1, 2, 3]).buffer;
      generateMock.mockResolvedValue({ arrayBuffer: () => Promise.resolve(fakeBytes) });
      const metrics = new VoiceMetricsService();
      const service = new VoiceService(fakeConfig(), metrics);

      const audio = await service.speak('Todo va bien.');

      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Todo va bien.', model: 'aura-2-celeste-es', encoding: 'mp3' }),
      );
      expect(audio).toBeInstanceOf(Buffer);
      expect(metrics.getSnapshot().totalTtsCalls).toBe(1);
      expect(metrics.getSnapshot().recent[0]).toMatchObject({ ok: true, characters: 'Todo va bien.'.length });
    });

    it('un fallo de Deepgram propaga el error y queda registrado con ok:false', async () => {
      generateMock.mockRejectedValue(new Error('rate limited'));
      const metrics = new VoiceMetricsService();
      const service = new VoiceService(fakeConfig(), metrics);

      await expect(service.speak('Hola')).rejects.toThrow('rate limited');
      expect(metrics.getSnapshot().recent[0].ok).toBe(false);
    });
  });
});
