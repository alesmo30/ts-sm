import { extractText, getDocumentProxy } from 'unpdf';

import { cleanExtractedText } from './clean-text';

export async function extractPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return cleanExtractedText(text);
}
