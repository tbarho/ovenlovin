ALTER TABLE "meal_plan_entry" ALTER COLUMN "scale_factor" SET DATA TYPE numeric(10, 4);
--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ALTER COLUMN "scale_factor" SET DEFAULT '1';
