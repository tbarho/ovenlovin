ALTER TABLE "person" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;

UPDATE "person" AS p
SET "sort_order" = s.rn - 1
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY household_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM "person"
  WHERE deleted_at IS NULL
) AS s
WHERE p.id = s.id;
