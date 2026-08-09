import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { extractText, getDocumentProxy } from 'unpdf';

import { chunkByParagraphs } from '../modules/knowledge/chunker';

import { resolveFromRepoRoot } from './repo-root';
import { referenceChunks, references } from './schema';

const MAX_CHUNK_CHARS = 1500;
const CHUNK_OVERLAP = 150;
const BODY_PREVIEW_CHARS = 500;

// Bytes de control (excepto tab/newline/CR) que algunos PDFs con fuentes
// corruptas dejan en el texto extraído y que Postgres UTF8 rechaza directamente.
const CONTROL_CHAR_CODES = Array.from({ length: 32 }, (_, code) => code).filter(
  (code) => code !== 9 && code !== 10 && code !== 13,
);
const CONTROL_CHARS_REGEX = new RegExp(
  `[${CONTROL_CHAR_CODES.map((code) => String.fromCharCode(code)).join('')}]`,
  'g',
);

const SPANISH_STOPWORDS = [
  'de',
  'la',
  'el',
  'en',
  'que',
  'los',
  'las',
  'una',
  'para',
  'con',
  'por',
  'del',
  'como',
  'más',
  'su',
  'al',
];

const ENGLISH_STOPWORDS = [
  'the',
  'and',
  'of',
  'to',
  'in',
  'is',
  'for',
  'with',
  'that',
  'on',
  'as',
  'are',
  'by',
  'an',
  'from',
];

type Lang = 'spanish' | 'english';

function detectLanguage(text: string): Lang {
  const lower = text.toLowerCase();
  const countMatches = (words: string[]): number =>
    words.reduce((total, word) => {
      const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'));
      return total + (matches?.length ?? 0);
    }, 0);

  const spanishScore = countMatches(SPANISH_STOPWORDS);
  const englishScore = countMatches(ENGLISH_STOPWORDS);

  return englishScore > spanishScore ? 'english' : 'spanish';
}

async function walkPdfFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkPdfFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(fullPath);
    }
  }

  return files;
}

interface IngestReport {
  ingested: string[];
  skippedExisting: string[];
  noExtractableText: string[];
  totalChunks: number;
}

async function ingest(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL debe estar definida para correr kb:ingest');
  }

  const rawKnowledgeDir = process.env.KNOWLEDGE_LOCAL_DIR;
  if (!rawKnowledgeDir) {
    throw new Error('KNOWLEDGE_LOCAL_DIR debe estar definida para correr kb:ingest');
  }
  const knowledgeDir = resolveFromRepoRoot(rawKnowledgeDir);

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const report: IngestReport = {
    ingested: [],
    skippedExisting: [],
    noExtractableText: [],
    totalChunks: 0,
  };

  const pdfFiles = await walkPdfFiles(knowledgeDir);

  console.log(`Encontrados ${pdfFiles.length} PDFs en ${knowledgeDir}`);

  for (const filePath of pdfFiles) {
    const name = path.basename(filePath);

    const [existing] = await db
      .select({ id: references.id })
      .from(references)
      .where(eq(references.name, name));

    if (existing) {
      report.skippedExisting.push(name);
      continue;
    }

    const buffer = await readFile(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const cleanedText = text.replace(CONTROL_CHARS_REGEX, '').trim();

    if (!cleanedText) {
      report.noExtractableText.push(name);
      continue;
    }

    const lang = detectLanguage(cleanedText);
    const body = cleanedText.slice(0, BODY_PREVIEW_CHARS);
    const chunks = chunkByParagraphs(cleanedText, MAX_CHUNK_CHARS, CHUNK_OVERLAP);

    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(references)
        .values({
          name,
          type: 'PDF',
          sizeBytes: buffer.byteLength,
          active: true,
          version: 1,
          chunks: chunks.length,
          body,
        })
        .onConflictDoNothing({ target: references.name })
        .returning({ id: references.id });

      if (!inserted) {
        return;
      }

      for (const [seq, chunkText] of chunks.entries()) {
        await tx.insert(referenceChunks).values({
          referenceId: inserted.id,
          seq,
          text: chunkText,
          sourceText: null,
          lang,
          translated: false,
        });
      }
    });

    report.ingested.push(name);
    report.totalChunks += chunks.length;
  }

  await pool.end();

  console.log('--- Reporte de ingesta ---');
  console.log(`Documentos ingeridos: ${report.ingested.length}`);
  console.log(`Chunks creados: ${report.totalChunks}`);
  console.log(`Ya existían (omitidos): ${report.skippedExisting.length}`);
  console.log(`Sin texto extraíble: ${report.noExtractableText.length}`);
  if (report.noExtractableText.length > 0) {
    console.log(report.noExtractableText.map((name) => `  - ${name}`).join('\n'));
  }
}

ingest().catch((error) => {
  console.error('Falló kb:ingest:', error);
  process.exit(1);
});
