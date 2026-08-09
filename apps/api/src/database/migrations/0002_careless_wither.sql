-- drizzle-kit no ve extensiones (schemaFilter: ['app'] en drizzle.config.ts las oculta) y
-- docker/db/init.sql solo corre en volumen nuevo, así que esta migración la crea de forma
-- defensiva para que también funcione contra un volumen de Postgres preexistente.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."reference_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"text" text NOT NULL,
	"source_text" text,
	"lang" text NOT NULL,
	"translated" boolean DEFAULT false NOT NULL,
	-- tsv se calcula siempre a partir de "text" (que ya viene en español, ver SPEC 07)
	"tsv" tsvector GENERATED ALWAYS AS (to_tsvector('spanish', "text")) STORED NOT NULL,
	"embedding" vector(768)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."reference_chunks" ADD CONSTRAINT "reference_chunks_reference_id_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "app"."references"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reference_chunks_tsv_idx" ON "app"."reference_chunks" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reference_chunks_ref_idx" ON "app"."reference_chunks" USING btree ("reference_id","seq");