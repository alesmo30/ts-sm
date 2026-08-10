import { integer, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { appSchema } from './pg-schema';
import { sessions } from './sessions';

export const priorityPatients = appSchema.table(
  'priority_patients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    patientName: text('patient_name').notNull(),
    procedure: text('procedure').notNull(),
    requestedBy: text('requested_by').notNull(),
    status: text('status', { enum: ['ok', 'attn', 'fail'] }).notNull(),
    llmSummary: text('llm_summary').notNull(),
    outcome: text('outcome').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    caseNotes: text('case_notes').notNull(),
  },
  (table) => [uniqueIndex('priority_patients_session_id_uidx').on(table.sessionId)],
);
