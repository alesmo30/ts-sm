import { z } from 'zod';

export const StatsCountsSchema = z.object({
  sessions: z.number().int().nonnegative(),
  priorityPatients: z.number().int().nonnegative(),
  references: z.number().int().nonnegative(),
});
export type StatsCounts = z.infer<typeof StatsCountsSchema>;
