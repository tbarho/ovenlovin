CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."rule_kind" AS ENUM('allergen', 'ingredient', 'ingredient_category', 'diet', 'tag', 'custom');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('block', 'warn', 'prefer_avoid');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."shared_facility" AS ENUM('block', 'warn', 'ignore');--> statement-breakpoint
CREATE TYPE "public"."allergen_relation" AS ENUM('contains', 'may_contain', 'derived_from', 'commonly_cross_contact');--> statement-breakpoint
CREATE TYPE "public"."ingredient_category" AS ENUM('produce', 'dairy', 'meat', 'seafood', 'grains', 'pantry', 'spices', 'baking', 'frozen', 'canned', 'condiments', 'beverages', 'other');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'us', 'count');--> statement-breakpoint
CREATE TYPE "public"."recipe_source_type" AS ENUM('url', 'photo', 'voice', 'paste', 'email', 'pdf', 'gdoc', 'app_export', 'social', 'manual');--> statement-breakpoint
CREATE TYPE "public"."recipe_status" AS ENUM('draft', 'needs_review', 'published');--> statement-breakpoint
CREATE TYPE "public"."recipe_visibility" AS ENUM('private', 'household', 'shared', 'public');--> statement-breakpoint
CREATE TYPE "public"."busy_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."meal_plan_status" AS ENUM('draft', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."share_grantee_type" AS ENUM('household', 'user', 'public');--> statement-breakpoint
CREATE TYPE "public"."share_permission" AS ENUM('view', 'comment', 'edit');--> statement-breakpoint
CREATE TYPE "public"."share_resource_type" AS ENUM('recipe', 'collection', 'meal_plan', 'shopping_list');--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"clerk_org_id" varchar(255),
	CONSTRAINT "household_slug_unique" UNIQUE("slug"),
	CONSTRAINT "household_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	CONSTRAINT "user_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "nutrition_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"metric" varchar(100) NOT NULL,
	"target_min" numeric(10, 2),
	"target_max" numeric(10, 2),
	"period" varchar(50) DEFAULT 'day' NOT NULL,
	"rationale" varchar(100),
	"active_from" date,
	"active_until" date
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" varchar(255) NOT NULL,
	"birth_year" integer,
	"birth_month" integer,
	"sex" "sex",
	"activity_profile" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "person_label_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"note" text NOT NULL,
	"ingredient_id" uuid,
	"category" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "person_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "rule_kind" NOT NULL,
	"target" varchar(255) NOT NULL,
	"severity" "severity" NOT NULL,
	"include_may_contain" boolean DEFAULT false,
	"include_cross_contact" boolean DEFAULT false,
	"shared_facility" "shared_facility" DEFAULT 'ignore',
	"include_unmapped_ingredients" boolean DEFAULT false,
	"include_descendants" boolean DEFAULT true,
	"treat_coconut_as_tree_nut" boolean DEFAULT true,
	"label" varchar(255),
	"note" text,
	"active_from" date,
	"active_until" date,
	"set_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"value" varchar(255) NOT NULL,
	"weight" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "allergen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"description" text,
	CONSTRAINT "allergen_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"category" "ingredient_category",
	"fdc_id" varchar(50),
	"density" numeric(10, 4),
	"default_store_unit" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "ingredient_allergen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"ingredient_id" uuid NOT NULL,
	"allergen_id" uuid NOT NULL,
	"relation" "allergen_relation" NOT NULL,
	"source" varchar(255),
	"reviewed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" varchar(100) NOT NULL,
	"abbreviation" varchar(20),
	"system" "unit_system" NOT NULL,
	"conversion_to_base" numeric(20, 10),
	"base_unit" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"visibility" "recipe_visibility" DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"collection_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE "cook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"cooked_at" varchar(50) NOT NULL,
	"notes" text,
	"servings_made" integer
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"description" text,
	"yield_quantity" numeric(10, 2),
	"yield_unit" varchar(50),
	"servings" integer,
	"prep_time_minutes" integer,
	"cook_time_minutes" integer,
	"total_time_minutes" integer,
	"active_time_minutes" integer,
	"method_tags" jsonb DEFAULT '[]'::jsonb,
	"cuisine" varchar(100),
	"course" varchar(100),
	"difficulty" varchar(50),
	"equipment" jsonb DEFAULT '[]'::jsonb,
	"images" jsonb DEFAULT '[]'::jsonb,
	"status" "recipe_status" DEFAULT 'draft' NOT NULL,
	"visibility" "recipe_visibility" DEFAULT 'private' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_recipe_id" uuid,
	"is_family_recipe" boolean DEFAULT false,
	"family_story" text
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"group_id" uuid,
	"order" integer NOT NULL,
	"raw_text" text NOT NULL,
	"quantity_min" numeric(10, 4),
	"quantity_max" numeric(10, 4),
	"unit" varchar(100),
	"original_unit" varchar(100),
	"ingredient_id" uuid,
	"preparation" varchar(255),
	"is_optional" boolean DEFAULT false,
	"substitution_notes" text,
	"parse_confidence" numeric(3, 2)
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredient_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"name" varchar(255),
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_nutrition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"per_serving" boolean DEFAULT true NOT NULL,
	"calories" numeric(10, 2),
	"protein" numeric(10, 2),
	"carbohydrates" numeric(10, 2),
	"fat" numeric(10, 2),
	"fiber" numeric(10, 2),
	"sugar" numeric(10, 2),
	"sodium" numeric(10, 2),
	"is_computed" boolean DEFAULT true,
	"computation_method" varchar(100),
	"confidence" numeric(3, 2)
);
--> statement-breakpoint
CREATE TABLE "recipe_rating" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "recipe_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"type" "recipe_source_type" NOT NULL,
	"url" varchar(2048),
	"canonical_url" varchar(2048),
	"author" varchar(255),
	"attribution" text,
	"blob_refs" jsonb DEFAULT '[]'::jsonb,
	"importer_name" varchar(100),
	"importer_version" varchar(50),
	"model_used" varchar(100),
	"raw_extraction_json" jsonb,
	"license_note" text
);
--> statement-breakpoint
CREATE TABLE "recipe_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"text" text NOT NULL,
	"timers" jsonb DEFAULT '[]'::jsonb,
	"referenced_ingredient_ids" jsonb DEFAULT '[]'::jsonb,
	"image" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "recipe_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"household_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"color" varchar(7)
);
--> statement-breakpoint
CREATE TABLE "check_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"meal_plan_id" uuid NOT NULL,
	"entry_id" uuid,
	"person_id" uuid NOT NULL,
	"person_rule_id" uuid,
	"severity" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"evidence" jsonb
);
--> statement-breakpoint
CREATE TABLE "meal_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"status" "meal_plan_status" DEFAULT 'draft' NOT NULL,
	"generator" varchar(255),
	"generator_model" varchar(100),
	"latest_check_report" jsonb,
	"checked_at" timestamp with time zone,
	"content_hash" varchar(64),
	"acknowledged_warnings" jsonb DEFAULT '[]'::jsonb,
	"needs_recheck" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"meal_plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_slot" varchar(50) NOT NULL,
	"recipe_id" uuid,
	"freeform_meal" varchar(255),
	"servings" integer,
	"attendees" jsonb DEFAULT '[]'::jsonb,
	"scale_factor" integer DEFAULT 1,
	"prep_ahead_notes" text,
	"leftover_source_id" uuid
);
--> statement-breakpoint
CREATE TABLE "schedule_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_slot" varchar(50) NOT NULL,
	"busy_level" "busy_level",
	"time_budget_minutes" integer,
	"attendees" jsonb,
	"constraints" jsonb DEFAULT '[]'::jsonb,
	"reason" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "schedule_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"day_of_week" integer NOT NULL,
	"meal_slot" varchar(50) NOT NULL,
	"busy_level" "busy_level",
	"time_budget_minutes" integer,
	"attendees" jsonb DEFAULT '[]'::jsonb,
	"constraints" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "pantry_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric(10, 2),
	"unit" varchar(50),
	"location" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"meal_plan_id" uuid,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"list_id" uuid NOT NULL,
	"ingredient_id" uuid,
	"name" varchar(255) NOT NULL,
	"quantity" numeric(10, 2),
	"unit" varchar(50),
	"store_unit" varchar(50),
	"aisle_category" varchar(100),
	"source_entries" jsonb DEFAULT '[]'::jsonb,
	"is_checked" boolean DEFAULT false,
	"notes" text,
	"rule_warnings" jsonb DEFAULT '[]'::jsonb,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE "share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"resource_type" "share_resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"grantee_type" "share_grantee_type" NOT NULL,
	"grantee_household_id" uuid,
	"grantee_user_id" uuid,
	"permission" "share_permission" NOT NULL,
	"token" varchar(255),
	"expires_at" timestamp with time zone,
	CONSTRAINT "share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_goal" ADD CONSTRAINT "nutrition_goal_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_label_note" ADD CONSTRAINT "person_label_note_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_rule" ADD CONSTRAINT "person_rule_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_rule" ADD CONSTRAINT "person_rule_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference" ADD CONSTRAINT "preference_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_allergen" ADD CONSTRAINT "ingredient_allergen_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_allergen" ADD CONSTRAINT "ingredient_allergen_allergen_id_allergen_id_fk" FOREIGN KEY ("allergen_id") REFERENCES "public"."allergen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_recipe" ADD CONSTRAINT "collection_recipe_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_recipe" ADD CONSTRAINT "collection_recipe_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_log" ADD CONSTRAINT "cook_log_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_group_id_recipe_ingredient_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."recipe_ingredient_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredient_group" ADD CONSTRAINT "recipe_ingredient_group_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_source" ADD CONSTRAINT "recipe_source_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_step" ADD CONSTRAINT "recipe_step_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_result" ADD CONSTRAINT "check_result_meal_plan_id_meal_plan_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_result" ADD CONSTRAINT "check_result_entry_id_meal_plan_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."meal_plan_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_result" ADD CONSTRAINT "check_result_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_result" ADD CONSTRAINT "check_result_person_rule_id_person_rule_id_fk" FOREIGN KEY ("person_rule_id") REFERENCES "public"."person_rule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_meal_plan_id_meal_plan_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entry" ADD CONSTRAINT "meal_plan_entry_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_override" ADD CONSTRAINT "schedule_override_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_template" ADD CONSTRAINT "schedule_template_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_meal_plan_id_meal_plan_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_list_id_shopping_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_ingredient_id_ingredient_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_grantee_household_id_household_id_fk" FOREIGN KEY ("grantee_household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_grantee_user_id_user_id_fk" FOREIGN KEY ("grantee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;