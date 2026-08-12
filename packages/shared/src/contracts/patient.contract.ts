import { z } from 'zod';

import { SessionStatus } from './session.contract';

export const PriorityPatientSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  patientName: z.string(),
  procedure: z.string(),
  requestedBy: z.string(),
  status: SessionStatus,
  llmSummary: z.string(),
  outcome: z.string(),
  durationSeconds: z.number().int(),
  caseNotes: z.string(),
  // Fecha de la sesión vinculada (sessions.date, 'YYYY-MM-DD'). Null cuando
  // sessionId es null (la sesión que la originó fue borrada).
  sessionDate: z.string().nullable(),
});
export type PriorityPatient = z.infer<typeof PriorityPatientSchema>;
