import { z } from 'zod';

export const ReferenceType = z.enum(['PDF', 'MD', 'TXT', 'JSON', 'NOTA']);
export type ReferenceType = z.infer<typeof ReferenceType>;

export const ReferenceOrigin = z.enum(['corpus', 'upload']);
export type ReferenceOrigin = z.infer<typeof ReferenceOrigin>;

export const ReferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: ReferenceType,
  addedAt: z.coerce.date(),
  sizeBytes: z.number().int().nullable(),
  active: z.boolean(),
  version: z.number().int(),
  chunks: z.number().int(),
  body: z.string(),
  origin: ReferenceOrigin,
});
export type Reference = z.infer<typeof ReferenceSchema>;

export const IngestStage = z.enum([
  'Recibido',
  'Extrayendo texto',
  'Fragmentando',
  'Generando embeddings',
  'Indexado',
]);
export type IngestStage = z.infer<typeof IngestStage>;

export const IngestJobSchema = z.object({
  id: z.string().uuid(),
  referenceId: z.string().uuid().nullable(),
  fileName: z.string(),
  stage: IngestStage,
  pct: z.number().int().min(0).max(100),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type IngestJob = z.infer<typeof IngestJobSchema>;

export const KbStateSchema = z.object({ version: z.number().int() });
export type KbState = z.infer<typeof KbStateSchema>;

export const CreateReferenceTextSchema = z.object({
  name: z.string().min(1).max(200),
  body: z.string().min(1).max(200_000),
});
export type CreateReferenceTextInput = z.infer<typeof CreateReferenceTextSchema>;

export const UpdateReferenceActiveSchema = z.object({ active: z.boolean() });
export type UpdateReferenceActiveInput = z.infer<typeof UpdateReferenceActiveSchema>;
