CREATE TABLE IF NOT EXISTS "app"."ingest_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid,
	"file_name" text NOT NULL,
	"stage" text NOT NULL,
	"pct" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."kb_state" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "kb_state_singleton_check" CHECK ("app"."kb_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."priority_patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"patient_name" text NOT NULL,
	"procedure" text NOT NULL,
	"requested_by" text NOT NULL,
	"status" text NOT NULL,
	"llm_summary" text NOT NULL,
	"outcome" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"case_notes" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"size_bytes" integer,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"chunks" integer DEFAULT 0 NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"patient_name" text NOT NULL,
	"procedure" text NOT NULL,
	"status" text NOT NULL,
	"kb_version" integer DEFAULT 1 NOT NULL,
	"summary" text,
	"structured_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"who" text NOT NULL,
	"text" text NOT NULL,
	"is_voice" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kb_version" integer NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."ingest_jobs" ADD CONSTRAINT "ingest_jobs_reference_id_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "app"."references"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."priority_patients" ADD CONSTRAINT "priority_patients_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "app"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."transcripts" ADD CONSTRAINT "transcripts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "app"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "references_active_idx" ON "app"."references" USING btree ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_patient_name_idx" ON "app"."sessions" USING btree ("patient_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_procedure_idx" ON "app"."sessions" USING btree ("procedure");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transcripts_session_seq_uidx" ON "app"."transcripts" USING btree ("session_id","seq");