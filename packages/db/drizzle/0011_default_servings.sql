ALTER TABLE "household" ADD COLUMN "default_servings_mode" varchar(16) DEFAULT 'family' NOT NULL;
--> statement-breakpoint
ALTER TABLE "household" ADD COLUMN "default_servings_count" integer;
