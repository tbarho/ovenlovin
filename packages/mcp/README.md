# @ovenlovin/mcp

Remote MCP server over Streamable HTTP for OvenLovin recipe and meal planning platform.

## Overview

This package implements the Model Context Protocol (MCP) server that provides tools and resources for:

- **Recipe management**: Search, get details, import recipes
- **Household context**: Get schedules, people, rules, and preferences
- **Meal planning**: Check plans against rules, save plans, retrieve plans
- **Shopping lists**: Export aggregated shopping lists with rule warnings

## Auth

- **OAuth 2.1 via Clerk**: For ChatGPT, Claude Desktop, and other OAuth clients
- **Scoped API keys**: For Grok Bot, CLI, and programmatic access

Scopes:
- `recipes:read` - Search and read recipes
- `recipes:write` - Import and edit recipes
- `plans:read` - Read meal plans
- `plans:write` - Create and update meal plans
- `people:read` - Read household context and rules
- `people:write` - Edit rules and preferences
- `lists:export` - Export shopping lists

## Tools

### `search_recipes`

Search for recipes with filters. Can exclude recipes with blocking rules for specific attendees.

```json
{
  "query": "chicken",
  "forAttendees": ["person-id-1", "person-id-2"],
  "methodTags": ["crock_pot"],
  "maxResults": 20
}
```

### `get_recipe`

Get full recipe details including ingredients, steps, and nutrition.

```json
{
  "id": "recipe-uuid",
  "includeNutrition": true,
  "includeSource": false
}
```

### `import_recipe`

Import a recipe from URL or pasted text.

```json
{
  "source": "url",
  "content": "https://example.com/recipe",
  "skipReview": false
}
```

### `get_household_context`

Get household schedule, people, rules, preferences, and recent meals.

```json
{
  "includeSchedule": true,
  "includePeople": true,
  "includePreferences": true,
  "includeRecentMeals": true
}
```

### `reorder_people`

Persist the household people order used by lists, who-can-eat, and household context.

```json
{
  "personIds": ["person-id-1", "person-id-2"]
}
```

### `manage_person_rules`

List, add, or remove Can't eat / Doesn't like rules. Tree-nut rules accept `treatCoconutAsTreeNut` (default **false** — coconut is not a tree nut unless the family turns it on).

```json
{
  "action": "add",
  "personId": "person-id-1",
  "kind": "allergen",
  "target": "tree_nut",
  "severity": "block",
  "treatCoconutAsTreeNut": false
}
```

### `get_person_rules`

Get detailed per-person rules (Can't eat / Doesn't like) and Loves.

```json
{
  "personIds": ["person-id-1"],
  "includeInactive": false
}
```

### `manage_person_loves`

List, add, or remove a Love. Loves never filter recipes; they boost ranking and show “Name loves this”.

```json
{
  "action": "add",
  "personId": "person-id-1",
  "value": "salmon"
}
```

### `check_meal_plan`

**MUST** be called before saving a plan. Returns per-entry, per-person findings by severity.

```json
{
  "plan": {
    "weekStart": "2026-10-13",
    "entries": [
      {
        "date": "2026-10-13",
        "meal": "dinner",
        "recipeId": "recipe-uuid",
        "servings": 4,
        "attendees": ["person-id-1", "person-id-2"]
      }
    ]
  }
}
```

### `save_meal_plan`

Save a meal plan with the check report.

```json
{
  "weekStart": "2026-10-13",
  "entries": [...],
  "checkReportJson": { ... },
  "status": "draft"
}
```

### `get_meal_plan`

Get a saved meal plan by ID or week start date.

```json
{
  "planId": "plan-uuid"
}
```

### `export_shopping_list`

Export shopping list in various formats.

```json
{
  "planId": "plan-uuid",
  "format": "markdown",
  "groupBy": "aisle",
  "includeRuleWarnings": true
}
```

## Resources

Resources provide read-only access to household data:

- `ovenlovin://household/{id}/profile` - Household profile
- `ovenlovin://household/{id}/schedule` - Weekly schedule template
- `ovenlovin://household/{id}/people` - People with rules

## Usage

### ChatGPT (Actions/App)

```json
{
  "url": "https://yourdomain.com/mcp",
  "auth": {
    "type": "oauth",
    "authorization_url": "https://yourdomain.com/oauth/authorize",
    "token_url": "https://yourdomain.com/oauth/token",
    "scope": "recipes:read recipes:write plans:write people:read"
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "ovenlovin": {
      "url": "https://yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Grok Bot

```bash
export OVENLOVIN_API_KEY=your_api_key
# Grok Bot will use MCP URL and API key from config
```

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Build
pnpm build

# Test
pnpm test

# Test stdio transport locally
pnpm dev
```

## Implementation Status

- ✅ Server foundation and tool registry
- ✅ Tool schemas and interfaces
- ✅ Resource listing and reading
- ✅ Auth stubs (OAuth + API keys)
- ⏳ Tool implementations (depend on @ovenlovin/core services)
- ⏳ Rules engine integration (depends on @ovenlovin/allergens)
- ⏳ Import integration (depends on @ovenlovin/importers)
- ⏳ Streamable HTTP transport for Next.js
- ⏳ Full auth implementation (Clerk OAuth + API key validation)
- ⏳ Tests

## Architecture

```
MCP Server (this package)
    ↓
@ovenlovin/core (business logic)
    ↓
@ovenlovin/db (Drizzle + Postgres)
```

All business logic lives in `@ovenlovin/core`. This package is a thin MCP adapter.

## Safety: Per-Person Rules

All allergy and dietary restriction checking is **per-person** with **configurable severities**:

- `block` - Blocking finding, prominent warning
- `warn` - Warning, shown in plan and shopping list
- `prefer_avoid` - Lowers preference score

Warnings **always name the person, rule, ingredient, and reason**. Never silent.

## See Also

- [Spec](https://github.com/tbarho/ovenlovin/issues/1)
- [AGENTS.md](../../AGENTS.md)
- MCP Specification: https://modelcontextprotocol.io
