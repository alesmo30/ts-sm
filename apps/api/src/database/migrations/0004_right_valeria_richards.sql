ALTER TABLE "app"."sessions" ADD COLUMN "triage_level" text DEFAULT 'green' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD COLUMN "triage_areas" jsonb DEFAULT '{}'::jsonb NOT NULL;