ALTER TABLE "meal_plan" ADD COLUMN "cook_for" integer;
--> statement-breakpoint
-- Old UI stored the week count on every night. Recover it when they agree.
UPDATE "meal_plan" AS mp
SET "cook_for" = agreed.servings
FROM (
  SELECT
    e."meal_plan_id",
    MIN(e."servings") AS servings
  FROM "meal_plan_entry" AS e
  WHERE e."deleted_at" IS NULL
    AND e."servings" IS NOT NULL
    AND e."servings" > 0
  GROUP BY e."meal_plan_id"
  HAVING COUNT(DISTINCT e."servings") = 1
) AS agreed
WHERE mp."id" = agreed."meal_plan_id"
  AND mp."cook_for" IS NULL
  AND mp."deleted_at" IS NULL;
