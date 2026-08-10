import { Test } from '@nestjs/testing';

import { EmbeddingClient } from '../embeddings/embedding.client';

import type { EscalationConfig } from './escalation.config';
import { ESCALATION_CONFIG } from './escalation.tokens';
import { RedFlagDetectorService } from './red-flag-detector.service';
import { RED_FLAG_PHRASES } from './red-flag-phrases';

function makeConfig(overrides: Partial<EscalationConfig> = {}): EscalationConfig {
  return {
    similarityThreshold: 0.83,
    ...overrides,
  };
}

function fakeEmbeddingClient(overrides: Partial<EmbeddingClient> = {}) {
  return {
    isAvailable: true,
    embedBatch: jest.fn(),
    embedOne: jest.fn(),
    ...overrides,
  } as unknown as EmbeddingClient & { embedBatch: jest.Mock; embedOne: jest.Mock };
}

async function setup(config: EscalationConfig, embeddingClient: EmbeddingClient) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RedFlagDetectorService,
      { provide: ESCALATION_CONFIG, useValue: config },
      { provide: EmbeddingClient, useValue: embeddingClient },
    ],
  }).compile();

  return moduleRef.get(RedFlagDetectorService);
}

describe('RedFlagDetectorService', () => {
  it('sin GEMINI_API_KEY (EmbeddingClient no disponible), check() no llama a embedBatch y no dispara', async () => {
    const embeddingClient = fakeEmbeddingClient({ isAvailable: false });
    const service = await setup(makeConfig(), embeddingClient);
    await service.onModuleInit();

    const result = await service.check('Tengo fiebre muy alta y me cuesta respirar.');

    expect(embeddingClient.embedBatch).not.toHaveBeenCalled();
    expect(result).toEqual({ triggered: false, score: 0, matchedPhrase: null });
  });

  it('dispara cuando la similitud supera el umbral', async () => {
    const embeddingClient = fakeEmbeddingClient();
    embeddingClient.embedBatch.mockResolvedValue(RED_FLAG_PHRASES.map(() => [1, 0, 0]));
    const service = await setup(makeConfig(), embeddingClient);
    await service.onModuleInit();

    embeddingClient.embedOne.mockResolvedValue([1, 0, 0]);
    const result = await service.check('Tengo fiebre muy alta y me cuesta respirar.');

    expect(result.triggered).toBe(true);
    expect(result.score).toBeCloseTo(1, 5);
  });

  it('no dispara cuando la similitud queda por debajo del umbral', async () => {
    const embeddingClient = fakeEmbeddingClient();
    embeddingClient.embedBatch.mockResolvedValue(RED_FLAG_PHRASES.map(() => [1, 0, 0]));
    const service = await setup(makeConfig(), embeddingClient);
    await service.onModuleInit();

    embeddingClient.embedOne.mockResolvedValue([0, 1, 0]);
    const result = await service.check('Todo va bien, gracias.');

    expect(result.triggered).toBe(false);
    expect(result.score).toBeCloseTo(0, 5);
  });

  it('no dispara con un mensaje benigno de similitud moderada (calibración anti-falso-positivo)', async () => {
    const embeddingClient = fakeEmbeddingClient();
    embeddingClient.embedBatch.mockResolvedValue(RED_FLAG_PHRASES.map(() => [1, 0]));
    const service = await setup(makeConfig(), embeddingClient);
    await service.onModuleInit();

    // Similitud coseno ≈ 0.7 — el rango donde caían mensajes benignos con el
    // umbral 0.51 original (ver specs/problema-escalamiento-bloque5.md).
    embeddingClient.embedOne.mockResolvedValue([0.7, 0.714]);
    const result = await service.check('Hola, todo bien, solo quería confirmar mi cita de control.');

    expect(result.triggered).toBe(false);
    expect(result.score).toBeCloseTo(0.7, 1);
  });

  it('si Gemini falla en check(), cae a triggered:false sin lanzar', async () => {
    const embeddingClient = fakeEmbeddingClient();
    embeddingClient.embedBatch.mockResolvedValue(RED_FLAG_PHRASES.map(() => [1, 0, 0]));
    const service = await setup(makeConfig(), embeddingClient);
    await service.onModuleInit();

    embeddingClient.embedOne.mockRejectedValue(new Error('network error'));
    const result = await service.check('Tengo dolor');

    expect(result).toEqual({ triggered: false, score: 0, matchedPhrase: null });
  });

  it('si Gemini falla en onModuleInit(), queda desactivado y check() no llama a embedOne', async () => {
    const embeddingClient = fakeEmbeddingClient();
    embeddingClient.embedBatch.mockRejectedValue(new Error('network error'));
    const service = await setup(makeConfig(), embeddingClient);
    await service.onModuleInit();

    const result = await service.check('Tengo dolor');

    expect(embeddingClient.embedOne).not.toHaveBeenCalled();
    expect(result).toEqual({ triggered: false, score: 0, matchedPhrase: null });
  });
});
