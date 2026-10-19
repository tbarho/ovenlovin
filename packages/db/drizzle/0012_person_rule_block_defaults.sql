ALTER TABLE "person_rule" ALTER COLUMN "include_may_contain" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "person_rule" ALTER COLUMN "include_cross_contact" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "person_rule" ALTER COLUMN "shared_facility" SET DEFAULT 'block';
