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
});
export type PriorityPatient = z.infer<typeof PriorityPatientSchema>;
