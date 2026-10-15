ALTER TABLE "meal_plan" ADD COLUMN "edit_history" jsonb DEFAULT '[]'::jsonb;
