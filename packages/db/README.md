# @ovenlovin/db

Database schema and client for OvenLovin.

## Tech Stack

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon)
- **Migrations**: Drizzle Kit

## Schema Overview

The database is organized into logical domains:

### Core

- `household` - Multi-household tenancy
- `user` - Auth via Clerk
- `membership` - User-household relationships with roles

### People & Rules

- `person` - Household members (may or may not be users). `sort_order` is the persistent household display order.
- `person_rule` - Per-person dietary rules with severities (block/warn/prefer_avoid)
- `person_label_note` - Shopping/label reminders per person
- `preference` - Likes, cuisines, textures, etc.
- `nutrition_goal` - Per-person nutrition targets

### Ingredients & Allergens

- `allergen` - Taxonomy (tree structure, covers US Big 9 + EU 14 + custom)
- `ingredient` - Canonical ingredients
- `ingredient_allergen` - Ingredient-allergen mappings with relations
- `unit` - Canonical units with conversion factors

### Recipes

- `recipe` - Title, times, servings, method tags, etc.
- `recipe_ingredient_group` - Ingredient sections (e.g., "For the sauce")
- `recipe_ingredient` - Quantities, units, parse confidence
- `recipe_step` - Instructions with timers
- `recipe_nutrition` - Per-serving nutrition data
- `recipe_source` - Provenance (URL, photo, voice, paste, etc.)
- `tag`, `collection` - Organization
- `recipe_rating`, `cook_log` - Feedback

### Meal Planning

- `schedule_template` - Weekly schedule pattern
- `schedule_override` - Dated exceptions
- `meal_plan` - Weekly plan with check report
- `meal_plan_entry` - Date + meal slot + recipe + attendees
- `check_result` - Per-person rule violations

### Shopping

- `pantry_item` - Household pantry inventory
- `shopping_list` - Generated from meal plans
- `shopping_list_item` - Aggregated ingredients with rule warnings

### Sharing

- `share` - Resource sharing with permissions and expiry

## Commands

```bash
# Generate migration from schema changes
pnpm db:generate

# Run migrations
pnpm db:migrate

# Push schema to database (dev only)
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Usage

```typescript
import { createDbClient } from "@ovenlovin/db/client";
import { recipe, ingredient } from "@ovenlovin/db";

const db = createDbClient(process.env.DATABASE_URL!);

// Query recipes
const recipes = await db.select().from(recipe).limit(10);

// Query with relations
const recipesWithIngredients = await db.query.recipe.findMany({
  with: {
    ingredients: true,
  },
});
```

## Key Design Decisions

### Multi-household

Every entity has `household_id` where applicable. Row-level security ensures users only see their household's data.

### Per-person rules

Allergies and restrictions are **not** global. Each person has their own rules with configurable severities:

- `block` - Prominent warning, can exclude from search
- `warn` - Warning shown on plan and shopping list
- `prefer_avoid` - Lowers preference score

### Soft delete

All entities use `deleted_at` for soft deletion. Recipes, plans, and rules are never hard-deleted.

### Provenance tracking

- `created_by` - User or bot client
- `recipe_source` - Full import chain (URL, blob refs, model, raw extraction)
- Check reports stored with plan content hash

### Parse confidence

Recipe ingredients track `parse_confidence` (0-1). Low-confidence fields trigger review queue.

## Schema Spec

See [GitHub issue #1](https://github.com/tbarho/ovenlovin/issues/1), section 5 for the complete data model specification.
