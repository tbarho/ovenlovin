ALTER TABLE "recipe_source" ADD COLUMN "book_title" varchar(500);
--> statement-breakpoint
ALTER TABLE "recipe_source" ADD COLUMN "page_start" integer;
--> statement-breakpoint
ALTER TABLE "recipe_source" ADD COLUMN "page_end" integer;
