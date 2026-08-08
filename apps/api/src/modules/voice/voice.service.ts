import { DeepgramClient } from '@deepgram/sdk';
import { Injectable, Logger } from '@nestjs/common';

import { VoiceConfig } from './voice.config';
import { CLINICAL_KEYTERMS } from './voice.keyterms';
import { VoiceMetricsService } from './voice.metrics';

export interface SttSession {
  push(chunk: Buffer): void;
  /** Cierra el stream de Deepgram y resuelve con el transcript final, o null si no hubo habla o falló. */
  finish(): Promise<string | null>;
}

const SENTENCE_BREAK = /[.?!\n]/;
const MIN_PHRASE_LENGTH = 20;

/**
 * Acumula deltas de texto y libera frases completas apenas se cierran en un
 * punto, interrogación, exclamación o salto de línea, con un mínimo de
 * caracteres para no sintetizar fragmentos sueltos ("Sí.") de forma aislada.
 */
export class PhraseSegmenter {
  private buffer = '';

  push(deltaText: string): string[] {
    this.buffer += deltaText;
    const phrases: string[] = [];

    let breakIndex = this.buffer.search(SENTENCE_BREAK);
    while (breakIndex !== -1) {
      const candidate = this.buffer.slice(0, breakIndex + 1).trim();
      if (candidate.length >= MIN_PHRASE_LENGTH) {
        phrases.push(candidate);
        this.buffer = this.buffer.slice(breakIndex + 1);
      } else {
        // Muy corto: seguir buscando el próximo corte más adelante en el buffer.
        const next = this.buffer.slice(breakIndex + 1).search(SENTENCE_BREAK);
        if (next === -1) break;
        breakIndex = breakIndex + 1 + next;
        continue;
      }
      breakIndex = this.buffer.search(SENTENCE_BREAK);
    }

    return phrases;
  }

  /** Al cerrar el stream: lo que quedó sin puntuación se sintetiza igual. */
  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining.length > 0 ? remaining : null;
  }
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly client: DeepgramClient | null;

  constructor(
    private readonly config: VoiceConfig,
    private readonly metrics: VoiceMetricsService,
  ) {
    this.client = config.provider === 'deepgram' && config.deepgramApiKey
      ? new DeepgramClient({ apiKey: config.deepgramApiKey })
      : null;
  }

  /** true solo con VOICE_PROVIDER=deepgram y key configurada. */
  get isAvailable(): boolean {
    return this.client !== null;
  }

  async startTranscription(): Promise<SttSession> {
    if (!this.client) {
      throw new Error('VoiceService.startTranscription() llamado sin proveedor Deepgram configurado.');
    }

    const startedAt = Date.now();
    const socket = await this.client.listen.v1.connect({
      model: this.config.sttModel,
      language: 'es',
      keyterm: CLINICAL_KEYTERMS,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      punctuate: 'true',
      smart_format: 'true',
      interim_results: 'true',
      Authorization: `token ${this.config.deepgramApiKey}`,
    });

    let finalTranscript = '';
    let settled = false;
    let resolveFinish!: (value: string | null) => void;
    const finished = new Promise<string | null>((resolve) => {
      resolveFinish = resolve;
    });

    const settle = (value: string | null, ok: boolean): void => {
      if (settled) return;
      settled = true;
      this.metrics.recordStt({
        model: this.config.sttModel,
        durationMs: Date.now() - startedAt,
        ok,
      });
      resolveFinish(value);
    };

    socket.on('message', (message) => {
      if (message.type === 'Results' && message.is_final) {
        const transcript = message.channel.alternatives[0]?.transcript ?? '';
        if (transcript) {
          finalTranscript = finalTranscript ? `${finalTranscript} ${transcript}` : transcript;
        }
      }
    });

    socket.on('close', () => {
      settle(finalTranscript.trim() || null, true);
    });

    socket.on('error', (error) => {
      this.logger.error(`Fallo en el socket de Deepgram STT: ${error.message}`);
      settle(null, false);
    });

    socket.connect();
    await socket.waitForOpen();

    return {
      push: (chunk: Buffer) => {
        if (socket.readyState === 1) {
          socket.sendMedia(chunk);
        }
      },
      finish: async () => {
        if (socket.readyState === 1) {
          socket.sendCloseStream({ type: 'CloseStream' });
        }
        return finished;
      },
    };
  }

  async speak(text: string): Promise<Buffer> {
    if (!this.client) {
      throw new Error('VoiceService.speak() llamado sin proveedor Deepgram configurado.');
    }

    const startedAt = Date.now();
    try {
      const response = await this.client.speak.v1.audio.generate({
        text,
        model: this.config.ttsModel,
        encoding: 'mp3',
      });
      const audio = Buffer.from(await response.arrayBuffer());

      this.metrics.recordTts({
        model: this.config.ttsModel,
        durationMs: Date.now() - startedAt,
        characters: text.length,
        ok: true,
      });

      return audio;
    } catch (error) {
      this.metrics.recordTts({
        model: this.config.ttsModel,
        durationMs: Date.now() - startedAt,
        characters: text.length,
        ok: false,
      });
      this.logger.error(`Fallo en Deepgram TTS: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
