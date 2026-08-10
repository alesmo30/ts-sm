import { LlmPort } from '../../llm/llm.port';
import type { LlmCompletion } from '../../llm/llm.types';

import { JsonExtractor } from './json.extractor';

import { ExtractionService } from './index';

function mockCompletion(text: string): LlmCompletion {
  return {
    text,
    model: 'mock',
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    latencyMs: 0,
  };
}

describe('ExtractionService', () => {
  it('extrae texto plano de un .txt sin llamar al LLM', async () => {
    const llmPort = { complete: jest.fn() } as unknown as LlmPort;
    const service = new ExtractionService(new JsonExtractor(llmPort));

    const result = await service.extract('TXT', Buffer.from('Hola mundo\n'), 'nota.txt');

    expect(result).toBe('Hola mundo');
    expect(llmPort.complete).not.toHaveBeenCalled();
  });

  it('convierte un .json en prosa vía LlmPort', async () => {
    const llmPort = {
      complete: jest.fn().mockResolvedValue(mockCompletion('El paciente debe reposar tres días.')),
    } as unknown as LlmPort;
    const service = new ExtractionService(new JsonExtractor(llmPort));

    const result = await service.extract(
      'JSON',
      Buffer.from(JSON.stringify({ reposo: '3 días' })),
      'reglas.json',
    );

    expect(result).toBe('El paciente debe reposar tres días.');
    expect(llmPort.complete).toHaveBeenCalledTimes(1);
  });

  it('rechaza un .json inválido antes de llamar al LLM', async () => {
    const llmPort = { complete: jest.fn() } as unknown as LlmPort;
    const service = new ExtractionService(new JsonExtractor(llmPort));

    await expect(service.extract('JSON', Buffer.from('{ mal json'), 'malo.json')).rejects.toThrow();
    expect(llmPort.complete).not.toHaveBeenCalled();
  });
});
