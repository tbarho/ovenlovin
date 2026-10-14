CREATE TABLE "demo_sandbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid,
	"api_key_plaintext" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"write_count" integer DEFAULT 0 NOT NULL,
	"import_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"writes_in_window" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "demo_sandbox" ADD CONSTRAINT "demo_sandbox_household_id_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."household"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "demo_sandbox" ADD CONSTRAINT "demo_sandbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "demo_sandbox" ADD CONSTRAINT "demo_sandbox_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "demo_sandbox_expires_at_idx" ON "demo_sandbox" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "demo_sandbox_household_id_idx" ON "demo_sandbox" USING btree ("household_id");
