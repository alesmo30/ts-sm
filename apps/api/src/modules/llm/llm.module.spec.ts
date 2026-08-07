import { Test } from '@nestjs/testing';

import { LlmModule } from './llm.module';
import { LlmPort } from './llm.port';

describe('LlmModule', () => {
  const originalEnv = process.env.LLM_PROVIDER;

  afterEach(() => {
    process.env.LLM_PROVIDER = originalEnv;
  });

  it('arranca con LLM_PROVIDER=mock y LlmPort es inyectable', async () => {
    process.env.LLM_PROVIDER = 'mock';

    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] }).compile();
    const port = moduleRef.get(LlmPort);

    expect(port).toBeDefined();
    expect(port.providerName).toBe('mock');
  });
});
