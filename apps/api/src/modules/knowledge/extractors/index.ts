import { Injectable } from '@nestjs/common';
import type { ReferenceType } from '@ts-sm/shared';

import { JsonExtractor } from './json.extractor';
import { extractPdf } from './pdf.extractor';
import { extractPlainText } from './text.extractor';

@Injectable()
export class ExtractionService {
  constructor(private readonly jsonExtractor: JsonExtractor) {}

  /** Texto pegado en el textarea no pasa por acá: el servicio lo usa tal cual. */
  extract(type: Exclude<ReferenceType, 'NOTA'>, buffer: Buffer, fileName: string): Promise<string> {
    switch (type) {
      case 'PDF':
        return extractPdf(buffer);
      case 'MD':
      case 'TXT':
        return extractPlainText(buffer);
      case 'JSON':
        return this.jsonExtractor.extract(buffer, fileName);
    }
  }
}

export { JsonExtractor } from './json.extractor';
export { extractPdf } from './pdf.extractor';
export { extractPlainText } from './text.extractor';
export { cleanExtractedText } from './clean-text';
