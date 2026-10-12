---
layout: default
title: Architecture
---

# Architecture

> **System design and monorepo structure**

OvenLovin is built as a pnpm + Turborepo monorepo with clear separation of concerns. Business logic lives in pure TypeScript packages, while interfaces (REST API, MCP server, CLI, web UI) are thin adapters.

## Design Principles

### 1. Business Logic in `@ovenlovin/core`

All business logic, validation, and services live in `packages/core` as pure TypeScript. REST APIs, MCP tools, CLI commands, and UI are thin adapters that call core services.

**Why**: External bots (Grok, ChatGPT, Claude) must get identical behavior through any interface.

**Example**:

```typescript
// packages/core/src/services/recipe-checker.ts
export const checkRecipe = (recipe: Recipe, attendees: Person[]): CheckResult => {
  // Pure business logic - no database, no HTTP, no side effects
  const findings = attendees.flatMap(person => 
    person.rules.flatMap(rule => 
      matchRule(recipe, rule)
    )
  );
  return { status: 'complete', findings };
};

// apps/web/src/app/api/v1/recipes/[id]/check/route.ts
export async function POST(req: Request) {
  const { attendees } = await req.json();
  const recipe = await db.recipes.findById(recipeId);
  const people = await db.people.findByIds(attendees);
  
  // Thin adapter - just calls core service
  const result = checkRecipe(recipe, people);
  
  return Response.json(result);
}
```

### 2. Zod-first Schemas

Every data structure starts as a zod schema. Use `zod-openapi` to generate OpenAPI specs.

**Example**:

```typescript
import { z } from 'zod';

export const recipeSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  cuisine: z.string().optional(),
  ingredients: z.array(ingredientSchema),
  instructions: z.array(z.string()),
  nutrition: nutritionSchema.optional(),
});

export type Recipe = z.infer<typeof recipeSchema>;
```

### 3. Safety-critical Rule Checking

Allergy and dietary restriction checking is safety-relevant. See [Allergy & Dietary Rules](rules.md) for safety invariants.

### 4. Generic Data Only

No real family names, photos, or private data in fixtures, tests, or docs. Use generic examples like "Parent A", "Child B", "Household 1".

## Repository Structure

```
ovenlovin/
├── apps/
│   └── web/                 # Next.js 15 App Router
│       ├── src/
│       │   ├── app/        # App Router pages and API routes
│       │   │   ├── api/v1/ # REST API endpoints
│       │   │   └── mcp/    # MCP HTTP transport endpoint
│       │   ├── components/ # React components
│       │   └── lib/        # UI utilities
│       ├── package.json
│       └── next.config.js
│
├── packages/
│   ├── core/               # Business logic (pure TypeScript)
│   │   ├── src/
│   │   │   ├── schemas/    # Zod schemas
│   │   │   ├── services/   # Business services
│   │   │   └── utils/      # Utilities
│   │   ├── package.json
│   │   └── vitest.config.ts
│   │
│   ├── db/                 # Database schema and migrations
│   │   ├── src/
│   │   │   ├── schema/     # Drizzle schema definitions
│   │   │   └── migrations/ # SQL migrations
│   │   └── package.json
│   │
│   ├── allergens/          # Allergen taxonomy and rule checker
│   │   ├── src/
│   │   │   ├── taxonomy/   # Allergen definitions
│   │   │   ├── matchers/   # Rule matching logic
│   │   │   └── __tests__/  # Test fixtures
│   │   └── package.json
│   │
│   ├── importers/          # Recipe importers
│   │   ├── src/
│   │   │   ├── url/        # URL importer
│   │   │   ├── photo/      # Photo/OCR importer
│   │   │   ├── text/       # Text importer
│   │   │   └── __tests__/  # Import eval fixtures
│   │   └── package.json
│   │
│   ├── mcp/                # MCP server
│   │   ├── src/
│   │   │   ├── tools/      # MCP tool definitions
│   │   │   ├── resources/  # MCP resources
│   │   │   └── server.ts   # MCP server entry point
│   │   └── package.json
│   │
│   ├── cli/                # CLI tool
│   │   ├── src/
│   │   │   ├── commands/   # CLI commands
│   │   │   └── cli.ts      # CLI entry point
│   │   └── package.json
│   │
│   └── ui/                 # Shared UI components
│       ├── src/
│       │   └── components/ # Reusable React components
│       └── package.json
│
├── docs/                   # Documentation
│   ├── index.md
│   ├── bot-setup.md
│   ├── rules.md
│   └── api-reference.md
│
├── .github/
│   └── workflows/          # CI/CD pipelines
│       ├── ci.yml          # Tests, lint, typecheck
│       └── deploy.yml      # Vercel deployment
│
├── package.json            # Root package (workspace config)
├── pnpm-workspace.yaml     # pnpm workspace definition
├── turbo.json              # Turborepo config
└── tsconfig.json           # Root TypeScript config
```

## Core Packages

### @ovenlovin/core

Pure TypeScript business logic. No database access, no HTTP, no side effects.

**Exports**:
- `schemas/` - Zod schemas for all data structures
- `services/` - Business services (recipe checker, meal planner, shopping list generator)
- `utils/` - Pure utilities (unit conversion, quantity math, text parsing)

**Testing**: Vitest with property-based tests (fast-check) for rule checking

**Example service**:

```typescript
// packages/core/src/services/shopping-list.ts
import type { MealPlan, Person, ShoppingList } from '../schemas';

export const generateShoppingList = (
  plan: MealPlan,
  attendees: Person[]
): ShoppingList => {
  // Aggregate ingredients across all recipes
  const items = aggregateIngredients(plan.entries);
  
  // Check each ingredient against attendee rules
  const warnings = items.flatMap(item =>
    checkIngredient(item, attendees)
  );
  
  // Group by grocery store section
  const sections = groupBySection(items);
  
  return { planId: plan.id, sections, warnings };
};
```

### @ovenlovin/db

Drizzle ORM schema and migrations for Neon Postgres.

**Schema design**:
- `households` - Multi-tenant isolation
- `people` - Household members
- `person_rules` - Per-person dietary rules (kind, target, severity)
- `recipes` - Recipe details and ingredients
- `meal_plans` - Weekly meal plans
- `meal_plan_entries` - Plan entries (date, slot, recipe, servings)

**Row-level security**: Every table has `household_id` for multi-tenant isolation

**Soft delete**: All tables have `deleted_at` (nullable)

**Audit**: All tables have `created_at`, `updated_at`, `created_by`

**Example schema**:

```typescript
// packages/db/src/schema/person-rules.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const personRules = pgTable('person_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull(),
  personId: uuid('person_id').notNull(),
  
  kind: text('kind').notNull(), // 'allergen' | 'ingredient' | 'dietary' | 'nutrition'
  target: text('target').notNull(), // 'peanut' | 'vegetarian' | etc.
  severity: text('severity').notNull(), // 'block' | 'warn' | 'prefer-avoid'
  notes: text('notes'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});
```

### @ovenlovin/allergens

Allergen taxonomy and rule matcher.

**Taxonomy**:
- Canonical allergen names (peanut, tree_nuts, dairy, etc.)
- Aliases (groundnuts → peanuts, cow's milk → dairy)
- Hidden ingredients (albumin → eggs, casein → dairy)
- Common misspellings and OCR errors

**Matchers**:
- `matchAllergen(ingredient, allergen)` - Check if ingredient contains allergen
- `matchDietary(ingredient, diet)` - Check if ingredient violates diet
- `matchNutrition(recipe, threshold)` - Check if recipe exceeds nutrition limit

**Testing**: Adversarial test fixtures (misspellings, plurals, OCR errors, hidden ingredients)

**Example**:

```typescript
// packages/allergens/src/matchers/allergen.ts
const peanutAliases = [
  'peanuts', 'peanut', 'groundnuts', 'groundnut',
  'peanut butter', 'peanut oil', 'arachis oil',
  'goober peas', 'monkey nuts'
];

export const matchPeanut = (ingredient: string): boolean => {
  const normalized = ingredient.toLowerCase().trim();
  return peanutAliases.some(alias => normalized.includes(alias));
};
```

### @ovenlovin/importers

Recipe importers from multiple sources.

**Importers**:
- **URL importer** - Fetch and extract from recipe websites
- **Photo importer** - OCR and AI extraction from recipe photos
- **Text importer** - Parse from pasted text
- **App exporters** - Import from Paprika, Mealie, RecipeSage exports

**Eval fixtures**: Input + expected output for regression testing

**Confidence scoring**: Each import returns a confidence score (0.0-1.0)

**Example**:

```typescript
// packages/importers/src/url/index.ts
export const importFromUrl = async (url: string): Promise<ImportResult> => {
  const html = await fetch(url).then(r => r.text());
  
  // Try structured data first (JSON-LD)
  const structured = extractStructuredData(html);
  if (structured) {
    return { recipe: structured, confidence: 0.95 };
  }
  
  // Fall back to AI extraction
  const extracted = await aiExtract(html);
  return { recipe: extracted, confidence: 0.75 };
};
```

### @ovenlovin/mcp

Model Context Protocol server for AI agents.

**Tools**:
- `search_recipes` - Search with filters
- `get_recipe` - Get full details
- `import_recipe` - Import from URL/text/photo
- `get_household_context` - Get members and rules
- `save_meal_plan` - Create/update plan
- `check_meal_plan` - Run allergen checks
- `export_shopping_list` - Generate list with warnings

**Resources**:
- `ovenlovin://household/{id}` - Household details
- `ovenlovin://person/{id}` - Person profile
- `ovenlovin://recipe/{id}` - Recipe data
- `ovenlovin://meal-plan/{id}` - Meal plan

**Transports**:
- Stdio: `npx @ovenlovin/mcp`
- HTTP: `https://your-app.vercel.app/mcp`

**Example tool**:

```typescript
// packages/mcp/src/tools/search-recipes.ts
export const searchRecipesTool = {
  name: 'search_recipes',
  description: 'Search recipes by text, cuisine, tags, prep time, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      cuisine: { type: 'string' },
      prepTimeMinutes_lte: { type: 'number' },
    },
  },
  handler: async (input) => {
    // Thin wrapper around core service
    return await recipeService.search(input);
  },
};
```

### @ovenlovin/cli

Command-line interface for scripting and automation.

**Commands**:
- `ovenlovin recipes search <query>` - Search recipes
- `ovenlovin recipes import --url <url>` - Import recipe
- `ovenlovin plans check <planId>` - Check meal plan
- `ovenlovin plans shopping-list <planId>` - Export shopping list

**Example**:

```bash
# Search recipes
ovenlovin recipes search "vegetarian pasta" --cuisine Italian

# Import recipe
ovenlovin recipes import --url https://example.com/carbonara

# Check meal plan
ovenlovin plans check plan-123 --attendees person-1,person-2

# Export shopping list
ovenlovin plans shopping-list plan-123 --format text
```

## Web App (@ovenlovin/web)

Next.js 15 App Router with REST API routes and web UI.

### API Routes

```
apps/web/src/app/api/v1/
├── recipes/
│   ├── route.ts              # GET /recipes (list), POST /recipes (create)
│   ├── import/route.ts       # POST /recipes/import
│   └── [id]/
│       ├── route.ts          # GET /recipes/{id}, PATCH /recipes/{id}
│       └── check/route.ts    # POST /recipes/{id}/check
│
├── households/
│   └── [id]/
│       ├── context/route.ts  # GET /households/{id}/context
│       └── people/
│           └── [personId]/
│               └── rules/
│                   └── route.ts # POST /people/{id}/rules
│
├── meal-plans/
│   ├── route.ts              # GET /meal-plans, POST /meal-plans
│   └── [id]/
│       ├── route.ts          # GET /meal-plans/{id}
│       ├── check/route.ts    # POST /meal-plans/{id}/check
│       └── shopping-list/route.ts # GET /meal-plans/{id}/shopping-list
│
└── openapi.json/route.ts     # GET /openapi.json (spec)
```

### MCP Endpoint

```
apps/web/src/app/mcp/route.ts  # POST /mcp (HTTP transport)
```

### Web UI

```
apps/web/src/app/
├── page.tsx                   # Homepage
├── recipes/                   # Recipe pages
├── meal-plans/                # Meal planning pages
├── household/                 # Household management pages
└── settings/                  # Settings pages
```

## Data Flow

### Recipe Import Flow

```
1. User: "Import https://example.com/cookies"
   ↓
2. Bot calls: POST /api/v1/recipes/import
   ↓
3. REST API: Validates request, calls core service
   ↓
4. Core service: Calls @ovenlovin/importers
   ↓
5. Importer: Fetches URL, extracts recipe, returns draft
   ↓
6. Core service: Validates draft, saves to DB
   ↓
7. REST API: Returns recipe + confidence score
   ↓
8. Bot: "I've imported Chocolate Chip Cookies (confidence 95%)"
```

### Meal Plan Check Flow

```
1. User: "Is this meal plan safe for everyone?"
   ↓
2. Bot calls: POST /api/v1/meal-plans/{id}/check
   ↓
3. REST API: Loads plan, attendees, rules from DB
   ↓
4. Core service: Calls @ovenlovin/allergens for each entry
   ↓
5. Allergens: Matches ingredients against rules
   ↓
6. Core service: Aggregates findings by severity
   ↓
7. REST API: Returns check result with findings
   ↓
8. Bot: "⚠️ Block: Parent A - recipe contains peanuts"
```

## Testing Strategy

### Unit Tests

- **@ovenlovin/core**: Business logic, services, utilities
- **@ovenlovin/allergens**: Rule matching, taxonomy
- **@ovenlovin/importers**: Recipe extraction, parsing

**Tool**: Vitest

**Example**:

```typescript
describe('checkRecipe', () => {
  it('blocks recipes with allergens', () => {
    const recipe = { ingredients: [{ name: 'peanut butter' }] };
    const person = { 
      rules: [{ kind: 'allergen', target: 'peanut', severity: 'block' }] 
    };
    
    const result = checkRecipe(recipe, [person]);
    
    expect(result.findings.block).toHaveLength(1);
    expect(result.findings.block[0].personId).toBe(person.id);
  });
});
```

### Property-based Tests

- **@ovenlovin/allergens**: "A recipe with an ingredient matching a person's `block` rule always yields a `block` finding"

**Tool**: fast-check

**Example**:

```typescript
import fc from 'fast-check';

it('always blocks recipes with blocked allergens', () => {
  fc.assert(
    fc.property(
      fc.allergen(),
      fc.recipe({ hasAllergen: true }),
      fc.person({ blockAllergen: true }),
      (allergen, recipe, person) => {
        const result = checkRecipe(recipe, [person]);
        expect(result.findings.block.length).toBeGreaterThan(0);
      }
    )
  );
});
```

### Integration Tests

- **Database access**: Drizzle queries, transactions, row-level security
- **API routes**: Request/response validation, authentication, error handling

**Tool**: Vitest + Neon test database

### E2E Tests

- **Web UI**: Import → review → configure rules → plan → check → export

**Tool**: Playwright (when UI is ready)

## CI/CD

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm test
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
```

### Vercel Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Run dev server (all packages)
pnpm dev

# Run dev server (specific package)
pnpm --filter @ovenlovin/web dev
pnpm --filter @ovenlovin/core test:watch

# Build
pnpm build

# Test
pnpm test
pnpm test:watch

# Lint & format
pnpm lint
pnpm format
pnpm typecheck
```

### Adding a New Feature

See [AGENTS.md](../AGENTS.md) for detailed guidelines on adding importers, MCP tools, REST endpoints, and rule types.

## Resources

- **[Bot Setup Guide](bot-setup.md)** - Connect AI bots to OvenLovin
- **[API Reference](api-reference.md)** - REST API endpoints and schemas
- **[Allergy & Dietary Rules](rules.md)** - Safety invariants and rule types
- **[AGENTS.md](../AGENTS.md)** - Development guidelines for AI agents

---

Built with ❤️ for AI-powered family meal planning
