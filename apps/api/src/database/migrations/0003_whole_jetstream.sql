ALTER TABLE "app"."ingest_jobs" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."ingest_jobs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."references" ADD COLUMN "origin" text DEFAULT 'corpus' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_jobs_created_idx" ON "app"."ingest_jobs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "priority_patients_session_id_uidx" ON "app"."priority_patients" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "references_origin_idx" ON "app"."references" USING btree ("origin");