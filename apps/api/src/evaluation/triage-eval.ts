import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { resolveFromRepoRoot } from '../database/repo-root';
import {
  accumulatedLevel,
  evaluate,
  maxLevel,
  mergeTriageAreas,
  type TriageAreas,
  type TriageLevel,
  type TriageSignal,
} from '../modules/escalation/triage.rules';

const DATASET_PATH = resolveFromRepoRoot('dataset-reto/dataset/dataset_final.xlsx');
const DATASET_FETCH_HINT = 'Dataset no encontrado. Corré `pnpm dataset:fetch` para descargarlo.';
const SHEET_XML_PATH = 'xl/worksheets/sheet1.xml';

interface DatasetRow {
  dialogoId: string;
  casoId: string;
  pacienteId: string;
  diaPostop: string;
  turnoIdx: number;
  hablante: string;
  texto: string;
  labelGroundTruth: string;
  capa: string;
}

function columnLetter(zeroBasedIndex: number): string {
  let index = zeroBasedIndex + 1;
  let letters = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

/**
 * `dataset_final.xlsx` viene de un escritor que omite el atributo `r=` en
 * `<row>` y `<c>` (posición de fila/columna). exceljs lo exige —sin él
 * `parseInt(undefined)` produce `NaN` y `set model` revienta con "Invalid row
 * number in model"—, así que se reconstruye el atributo por posición antes
 * de pasarle el buffer a exceljs. Si el archivo ya trae `r=` (otra corrida
 * del generador, u otro dataset), se deja intacto.
 */
async function patchMissingCellRefs(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const sheetFile = zip.file(SHEET_XML_PATH);
  if (!sheetFile) return buffer;

  const xml = await sheetFile.async('string');
  if (xml.includes('<row r=')) return buffer;

  let rowNumber = 0;
  const patched = xml.replace(/<row>([\s\S]*?)<\/row>/g, (_match, inner: string) => {
    rowNumber += 1;
    const cells = inner.match(/<c[^>]*>[\s\S]*?<\/c>|<c[^>]*\/>/g) ?? [];
    const patchedCells = cells
      .map((cell, columnIndex) => cell.replace('<c', `<c r="${columnLetter(columnIndex)}${rowNumber}"`))
      .join('');
    return `<row r="${rowNumber}">${patchedCells}</row>`;
  });

  zip.file(SHEET_XML_PATH, patched);
  const generated = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(generated);
}

async function loadDatasetRows(): Promise<DatasetRow[]> {
  if (!existsSync(DATASET_PATH)) {
    console.error(DATASET_FETCH_HINT);
    process.exit(1);
  }

  const rawBuffer = await readFile(DATASET_PATH);
  const patchedBuffer = await patchMissingCellRefs(rawBuffer);

  const workbook = new ExcelJS.Workbook();
  // `exceljs/index.d.ts` declara su propio tipo local `Buffer extends ArrayBuffer`
  // dentro del módulo, distinto (aunque homónimo) del `Buffer` real de
  // @types/node — no hay cast estructural posible entre ambos, de ahí `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(patchedBuffer as any);
  const sheet = workbook.getWorksheet('result');
  if (!sheet) {
    throw new Error('La hoja "result" no existe en dataset_final.xlsx.');
  }

  const rows: DatasetRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // encabezado
    const values = row.values as ExcelJS.CellValue[]; // índice 0 vacío, columnas desde 1
    rows.push({
      dialogoId: String(values[1] ?? ''),
      casoId: String(values[2] ?? ''),
      pacienteId: String(values[3] ?? ''),
      diaPostop: String(values[4] ?? ''),
      turnoIdx: Number(values[5]),
      hablante: String(values[6] ?? ''),
      texto: String(values[7] ?? ''),
      labelGroundTruth: String(values[8] ?? ''),
      capa: String(values[12] ?? ''),
    });
  });
  return rows;
}

type Label = 'verde' | 'amarillo' | 'rojo';
type Capa = 'capa1_limpia' | 'capa2_ruidosa';

interface EvalCase {
  casoId: string;
  capa: Capa;
  expected: Label;
  turns: string[];
}

/**
 * Agrupa por `caso_id` + `capa` (un mismo `caso_id` contiene ambas capas, ver
 * README del dataset), ordena por `turno_idx` y se queda con los textos de
 * `paciente` y `tercero` — el `agente` no entra: sus preguntas nombran los
 * síntomas y dispararían señales por el texto de la pregunta, no por el
 * estado del paciente.
 */
function buildCases(rows: DatasetRow[]): EvalCase[] {
  const grouped = new Map<string, DatasetRow[]>();
  for (const row of rows) {
    const key = `${row.casoId}::${row.capa}`;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  const cases: EvalCase[] = [];
  for (const [key, groupRows] of grouped) {
    const labels = new Set(groupRows.map((row) => row.labelGroundTruth));
    if (labels.size > 1) {
      throw new Error(`label_ground_truth no es constante dentro de ${key}: ${[...labels].join(', ')}`);
    }

    const sorted = [...groupRows].sort((a, b) => a.turnoIdx - b.turnoIdx);
    const turns = sorted
      .filter((row) => row.hablante === 'paciente' || row.hablante === 'tercero')
      .map((row) => row.texto);

    cases.push({
      casoId: sorted[0].casoId,
      capa: sorted[0].capa as Capa,
      expected: sorted[0].labelGroundTruth as Label,
      turns,
    });
  }
  return cases;
}

const LEVEL_TO_LABEL: Record<TriageLevel, Label> = { green: 'verde', yellow: 'amarillo', red: 'rojo' };

interface EvalResult {
  casoId: string;
  capa: Capa;
  expected: Label;
  predicted: Label;
  signals: TriageSignal[];
}

/**
 * Reproduce la acumulación exacta de `ConversationService` (SPEC 10):
 * `mergeTriageAreas` seguido de `maxLevel` con `accumulatedLevel`.
 * `askedAreas` va vacío y `grouped` en `false` porque el evaluador no
 * consume turnos del agente — ninguna de las dos entradas puede subir el
 * nivel por sí sola: `mergeTriageAreas` las marca con `level: 'green'`, y
 * `accumulatedLevel` solo cuenta áreas en `yellow`.
 */
function predictCase(evalCase: EvalCase): EvalResult {
  let level: TriageLevel = 'green';
  let areas: TriageAreas = {};
  const allSignals: TriageSignal[] = [];

  for (const text of evalCase.turns) {
    const signals = evaluate(text);
    allSignals.push(...signals);
    areas = mergeTriageAreas(areas, signals, [], false);
    level = maxLevel([level, ...signals.map((signal) => signal.level), accumulatedLevel(areas)]);
  }

  return {
    casoId: evalCase.casoId,
    capa: evalCase.capa,
    expected: evalCase.expected,
    predicted: LEVEL_TO_LABEL[level],
    signals: allSignals,
  };
}

function reportCaseCounts(cases: EvalCase[]): void {
  const byCapa = new Map<Capa, number>();
  for (const evalCase of cases) {
    byCapa.set(evalCase.capa, (byCapa.get(evalCase.capa) ?? 0) + 1);
  }
  for (const [capa, count] of byCapa) {
    console.log(`${capa}: ${count} casos`);
  }
}

const LABELS: Label[] = ['verde', 'amarillo', 'rojo'];
const CAPAS: Capa[] = ['capa1_limpia', 'capa2_ruidosa'];

type ConfusionMatrix = Record<Label, Record<Label, number>>;

function buildConfusionMatrix(results: EvalResult[]): ConfusionMatrix {
  const matrix = Object.fromEntries(
    LABELS.map((expected) => [expected, Object.fromEntries(LABELS.map((predicted) => [predicted, 0]))]),
  ) as ConfusionMatrix;

  for (const result of results) {
    matrix[result.expected][result.predicted] += 1;
  }
  return matrix;
}

function formatMatrixMarkdown(matrix: ConfusionMatrix): string {
  const header = `| referencia \\\\ predicho | ${LABELS.join(' | ')} |`;
  const separator = `| --- | ${LABELS.map(() => '---').join(' | ')} |`;
  const rows = LABELS.map((expected) => `| ${expected} | ${LABELS.map((predicted) => matrix[expected][predicted]).join(' | ')} |`);
  return [header, separator, ...rows].join('\n');
}

function redRecall(results: EvalResult[]): { hits: number; total: number } {
  const redCases = results.filter((result) => result.expected === 'rojo');
  const hits = redCases.filter((result) => result.predicted === 'rojo').length;
  return { hits, total: redCases.length };
}

function falseNegatives(results: EvalResult[]): { toGreen: EvalResult[]; toYellow: EvalResult[] } {
  const missedRed = results.filter((result) => result.expected === 'rojo' && result.predicted !== 'rojo');
  return {
    toGreen: missedRed.filter((result) => result.predicted === 'verde'),
    toYellow: missedRed.filter((result) => result.predicted === 'amarillo'),
  };
}

function formatSignals(signals: TriageSignal[]): string {
  if (signals.length === 0) return '(ninguna)';
  return signals.map((signal) => `${signal.area}:${signal.level}`).join(', ');
}

function formatFailedCasesMarkdown(results: EvalResult[]): string {
  const failed = results.filter((result) => result.predicted !== result.expected);
  if (failed.length === 0) return 'Ningún caso fallado en esta capa.';

  const header = '| caso_id | esperado | predicho | señales detectadas |';
  const separator = '| --- | --- | --- | --- |';
  const rows = failed.map(
    (result) => `| ${result.casoId} | ${result.expected} | ${result.predicted} | ${formatSignals(result.signals)} |`,
  );
  return [header, separator, ...rows].join('\n');
}

function getEvaluatedCommit(): string {
  try {
    return execFileSync(
      'git',
      ['log', '-1', '--format=%h', '--', 'apps/api/src/modules/escalation/triage.rules.ts'],
      { cwd: resolveFromRepoRoot('.'), encoding: 'utf-8' },
    ).trim();
  } catch {
    return '(desconocido — no se pudo leer git log)';
  }
}

function buildReportMarkdown(resultsByCapa: Map<Capa, EvalResult[]>): string {
  const today = new Date().toISOString().slice(0, 10);
  const commit = getEvaluatedCommit();

  const sections = CAPAS.map((capa) => {
    const results = resultsByCapa.get(capa) ?? [];
    const matrix = buildConfusionMatrix(results);
    const recall = redRecall(results);
    const fn = falseNegatives(results);

    return [
      `## ${capa}`,
      '',
      '### Matriz de confusión (referencia × predicho)',
      '',
      formatMatrixMarkdown(matrix),
      '',
      `**Recall de rojos:** ${recall.hits}/${recall.total}`,
      '',
      `**Falsos negativos rojo→verde (catastrófico):** ${fn.toGreen.length}`,
      `**Falsos negativos rojo→amarillo (grave):** ${fn.toYellow.length}`,
      '',
      '### Casos fallados',
      '',
      formatFailedCasesMarkdown(results),
    ].join('\n');
  });

  return [
    '# Evaluación de triage — SPEC 11',
    '',
    `**Fecha:** ${today}`,
    `**Commit evaluado de \`triage.rules.ts\`:** ${commit}`,
    '',
    '> Esta matriz mide **solo la rama determinística** del triage (`triage.rules.ts`). ' +
      '`RedFlagDetectorService` (similitud semántica, requiere `GEMINI_API_KEY`) y la marca ' +
      '`[[ESCALAR]]` del modelo no están incluidas — no son reproducibles offline sin costo. ' +
      'En producción esas dos señales solo pueden subir la severidad, nunca bajarla: esta matriz ' +
      'es un **piso**, no el rendimiento del sistema completo.',
    '',
    sections.join('\n\n'),
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const rows = await loadDatasetRows();
  const casoIds = new Set(rows.map((row) => row.casoId));
  console.log(`${rows.length} turnos, ${casoIds.size} casos`);

  const cases = buildCases(rows);
  reportCaseCounts(cases);

  const results = cases.map(predictCase);
  const correct = results.filter((result) => result.predicted === result.expected).length;
  console.log(`${correct}/${results.length} casos predichos correctamente (ambas capas)`);

  const resultsByCapa = new Map<Capa, EvalResult[]>(
    CAPAS.map((capa) => [capa, results.filter((result) => result.capa === capa)]),
  );

  for (const capa of CAPAS) {
    const capaResults = resultsByCapa.get(capa) ?? [];
    const recall = redRecall(capaResults);
    const fn = falseNegatives(capaResults);
    console.log(`\n${capa} — recall de rojos: ${recall.hits}/${recall.total}`);
    console.log(`${capa} — falsos negativos rojo→verde: ${fn.toGreen.length}, rojo→amarillo: ${fn.toYellow.length}`);
  }

  const reportMarkdown = buildReportMarkdown(resultsByCapa);
  const reportDir = resolveFromRepoRoot('reports');
  const reportPath = path.join(reportDir, 'triage-eval.md');
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, reportMarkdown, 'utf-8');
  console.log(`\nReporte escrito en ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
