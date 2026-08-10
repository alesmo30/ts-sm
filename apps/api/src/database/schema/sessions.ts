import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { appSchema } from './pg-schema';

export const sessions = appSchema.table(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    date: text('date').notNull(),
    time: text('time').notNull(),
    patientName: text('patient_name').notNull(),
    procedure: text('procedure').notNull(),
    status: text('status', { enum: ['ok', 'attn', 'fail'] }).notNull(),
    kbVersion: integer('kb_version').notNull().default(1),
    summary: text('summary'),
    structuredSummary: jsonb('structured_summary'),
    triageLevel: text('triage_level', { enum: ['green', 'yellow', 'red'] }).notNull().default('green'),
    triageAreas: jsonb('triage_areas').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_patient_name_idx').on(table.patientName),
    index('sessions_procedure_idx').on(table.procedure),
  ],
);

export const transcripts = appSchema.table(
  'transcripts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    who: text('who', { enum: ['patient', 'assistant', 'system'] }).notNull(),
    text: text('text').notNull(),
    isVoice: boolean('is_voice').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    citations: jsonb('citations').notNull().default([]),
    kbVersion: integer('kb_version').notNull(),
  },
  (table) => [uniqueIndex('transcripts_session_seq_uidx').on(table.sessionId, table.seq)],
);
