import { z } from 'zod';

export const StatsCountsSchema = z.object({
  sessions: z.number().int().nonnegative(),
  priorityPatients: z.number().int().nonnegative(),
  references: z.number().int().nonnegative(),
  /** Total de referencias con origin:'upload', activas o no — historial de lo subido manualmente, no solo lo vigente. */
  uploads: z.number().int().nonnegative(),
});
export type StatsCounts = z.infer<typeof StatsCountsSchema>;
