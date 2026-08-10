import { Injectable } from '@nestjs/common';

import { LlmPort } from '../../llm/llm.port';

import { cleanExtractedText } from './clean-text';

const JSON_TO_PROSE_PROMPT = `Convierte el siguiente JSON en prosa continua en español, en párrafos legibles, conservando todos los datos y su significado. No agregues comentarios ni inventes información. No uses viñetas, numerales ni ningún marcado — solo párrafos de texto plano.`;

@Injectable()
export class JsonExtractor {
  constructor(private readonly llmPort: LlmPort) {}

  async extract(buffer: Buffer, fileName: string): Promise<string> {
    const raw = buffer.toString('utf-8');

    try {
      // Falla rápido con un mensaje claro si el archivo no es JSON válido, antes
      // de gastar una llamada al LLM con contenido que no va a servir de nada.
      JSON.parse(raw);
    } catch {
      throw new Error(`El archivo "${fileName}" no es JSON válido.`);
    }

    const completion = await this.llmPort.complete(
      [
        { role: 'system', content: JSON_TO_PROSE_PROMPT },
        { role: 'user', content: raw },
      ],
      { temperature: 0 },
    );

    return cleanExtractedText(completion.text);
  }
}
