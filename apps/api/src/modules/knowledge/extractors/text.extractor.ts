import { cleanExtractedText } from './clean-text';

export async function extractPlainText(buffer: Buffer): Promise<string> {
  return cleanExtractedText(buffer.toString('utf-8'));
}
