ALTER TABLE "meal_plan" ADD COLUMN "created_by_api_key_id" uuid;
--> statement-breakpoint
ALTER TABLE "person_rule" ADD COLUMN "created_by_api_key_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_created_by_api_key_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_key"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "person_rule" ADD CONSTRAINT "person_rule_created_by_api_key_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."api_key"("id") ON DELETE no action ON UPDATE no action;
