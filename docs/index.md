---
layout: default
title: OvenLovin Documentation
---

# OvenLovin

> **LLM-optimized recipe and family meal-planning platform**

An open-source Next.js template for Vercel that provides a bot-first backend for recipe management, meal planning, and grocery lists. Built for AI agents (Grok Bot, ChatGPT, Claude) to help families manage weekly meal planning with per-person dietary rules and allergy checking.

## Features

- 📖 **Recipe management** with exhaustive import support (URL, photo/OCR, voice, paste, app exports)
- 👨‍👩‍👧‍👦 **Households & people** with per-person dietary rules (allergies, restrictions) and severities (block/warn/prefer-avoid)
- 📅 **Meal planning** with rule checking and schedule constraints
- 🛒 **Shopping lists** with aggregated ingredients and rule warnings
- 🤖 **Bot interfaces**: REST + OpenAPI, remote MCP server, CLI
- 🏥 **USDA FoodData Central** integration for nutrition data
- 🔐 **Clerk auth** with organizations (households)
- 🗄️ **Neon Postgres + Drizzle ORM**
- ☁️ **Vercel AI Gateway + eve** for all AI operations

## Quick Start

### Deploy to Vercel

The fastest way to get started is to deploy OvenLovin to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&project-name=ovenlovin&repository-name=ovenlovin&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%2C%7B%22type%22%3A%22blob%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22clerk%22%2C%22productSlug%22%3A%22clerk%22%7D%5D&env=USDA_FDC_API_KEY,NEXT_PUBLIC_INSTANCE_NAME&envDescription=USDA%20key%20and%20optional%20instance%20name.%20On%20Vercel%2C%20AI%20Gateway%20uses%20OIDC%20%E2%80%94%20no%20AI_GATEWAY_API_KEY%20needed.%20Neon%2C%20Blob%2C%20and%20Clerk%20come%20from%20the%20stores%20step.%20If%20Clerk%20is%20not%20offered%2C%20set%20NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%20and%20CLERK_SECRET_KEY%20in%20Vercel.&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform&demo-url=https://ovenlovin.vercel.app)

The one-click deploy will:
- Clone the repository to your GitHub account
- Create a new Vercel project
- Provision Neon Postgres, Vercel Blob, and Clerk
- Prompt for USDA and an optional instance name (AI Gateway uses OIDC on Vercel)
- Run database migrations during the Vercel build
- Deploy the Next.js app with all environment variables

If the Clerk store is not offered, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the Vercel project.

#### Environment Variables

- **DATABASE_URL** - Neon Postgres (auto-configured by the Neon store)
- **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY** / **CLERK_SECRET_KEY** - Clerk (auto-configured by the Clerk store, or [get keys](https://clerk.com))
- **BLOB_READ_WRITE_TOKEN** - Vercel Blob (auto-configured by the Blob store)
- **USDA_FDC_API_KEY** - USDA FoodData Central API key ([get one](https://fdc.nal.usda.gov/api-key-signup.html))
- **NEXT_PUBLIC_INSTANCE_NAME** - optional landing-page name (defaults to "Your OvenLovin")
- **AI_GATEWAY_API_KEY** - optional; on Vercel, AI Gateway authenticates with OIDC

### Local Development

```bash
# Clone the repository
git clone https://github.com/tbarho/ovenlovin.git
cd ovenlovin

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Documentation

### For Users

- **[Bot Setup Guide](bot-setup.md)** - Connect Grok Bot, ChatGPT, or Claude to OvenLovin
- **[Allergy & Dietary Rules](rules.md)** - Configure per-person dietary restrictions and allergen checking
- **[API Reference](api-reference.md)** - REST API endpoints and OpenAPI specification

### For Developers

- **[Architecture](architecture.md)** - System design and monorepo structure
- **[Contributing](../AGENTS.md)** - Development guidelines for agents and contributors
- **[GitHub Repository](https://github.com/tbarho/ovenlovin)** - Source code and issue tracker

## Use Cases

### Sunday Meal Planning

A family uses OvenLovin with their preferred AI bot to plan the week's meals:

1. **Bot**: "What dietary restrictions does your household have?"
2. **Family**: "Parent A has a peanut allergy, Child B is vegetarian"
3. **Bot**: Searches recipes, filters by restrictions, proposes a meal plan
4. **Bot**: Generates a shopping list organized by grocery store sections
5. **Bot**: Flags any potential allergen warnings

### Recipe Import

Import recipes from anywhere:

```
User: "Import this recipe: https://example.com/chocolate-chip-cookies"

Bot:
- Extracts recipe using AI-powered importer
- Checks if safe for household members
- Suggests substitutions if needed
- Saves to recipe library
```

### Weekly Grocery Run

Generate a complete shopping list:

```
User: "What do I need from the store this week?"

Bot:
- Aggregates ingredients from the week's meal plan
- Groups by grocery store section
- Marks items with allergen warnings
- Includes quantities with unit conversions
```

## Safety Features

OvenLovin takes allergen and dietary restriction checking seriously:

### Per-Person Rules

Each household member can have custom dietary rules with three severity levels:

- **block** - Recipe is unsafe for this person (hard allergen)
- **warn** - Recipe should be flagged for review (possible cross-contamination)
- **prefer-avoid** - Recipe is not preferred but not dangerous (dietary preference)

### Rule Types

- **allergen** - Food allergies (peanuts, tree nuts, dairy, eggs, fish, shellfish, wheat, soy, sesame)
- **ingredient** - Specific ingredient restrictions (garlic, onions, nightshades)
- **dietary** - Dietary patterns (vegetarian, vegan, gluten-free, kosher, halal)
- **nutrition** - Nutritional constraints (low-sodium, low-sugar, low-carb)

### Safety Invariants

OvenLovin guarantees:

1. ✅ Rule checking is deterministic for the same inputs
2. ✅ Warnings always name the affected person
3. ✅ Recipe edits or rule changes mark affected plans as `needs_recheck`
4. ✅ Incomplete checks are reported as `status: incomplete`, never "no issues"
5. ✅ No hard-coded allergen policies - all rules are per-person configuration

**Example**: If a recipe contains peanuts and Parent A has a `block` rule for peanuts, every API response will include:

```json
{
  "findings": {
    "block": [
      {
        "personId": "person-1",
        "personName": "Parent A",
        "severity": "block",
        "ingredientName": "peanuts",
        "message": "Parent A: recipe contains peanuts (block rule)"
      }
    ]
  }
}
```

Learn more in the [Allergy & Dietary Rules Guide](rules.md).

## Architecture

OvenLovin is built as a monorepo with clear separation of concerns:

### Core Packages

- **@ovenlovin/core** - Pure TypeScript business logic, zod schemas, services
- **@ovenlovin/db** - Drizzle ORM schema and migrations for Neon Postgres
- **@ovenlovin/allergens** - Allergen taxonomy and rule checker
- **@ovenlovin/importers** - Recipe importers (URL, photo/OCR, text, app exports)
- **@ovenlovin/mcp** - Model Context Protocol server for AI agents
- **@ovenlovin/cli** - Command-line interface tool

### Web App

- **@ovenlovin/web** - Next.js 15 App Router UI with REST API routes

### Design Principles

1. **Business logic in @ovenlovin/core** - All validation and services are pure TypeScript, shared across REST API, MCP server, CLI, and UI
2. **Zod-first schemas** - Every data structure starts as a zod schema, generates OpenAPI specs
3. **Safety-critical rule checking** - Per-person rules, deterministic, always reports affected person
4. **Bot-optimized** - External bots (Grok, ChatGPT, Claude) get identical behavior through any interface
5. **Generic data only** - No real family names, photos, or private data in tests or docs

See the full [Architecture Guide](architecture.md) for more details.

## API Reference

OvenLovin provides multiple interfaces for AI agents:

### REST API

Standard REST API with OpenAPI 3.1 specification:

- **Base URL**: `https://your-app.vercel.app/api/v1`
- **Authentication**: Bearer token (API keys)
- **Pagination**: Cursor-based
- **Errors**: RFC 9457 Problem Details

Download the OpenAPI spec:
- JSON: `https://your-app.vercel.app/api/v1/openapi.json`
- YAML: `https://your-app.vercel.app/api/v1/openapi.yaml`

[View full API reference →](api-reference.md)

### MCP Server

Model Context Protocol server for structured tool access:

- **Stdio transport**: `npx @ovenlovin/mcp`
- **HTTP transport**: `https://your-app.vercel.app/mcp`

Available tools:
- `search_recipes` - Search recipes by text, filters
- `get_recipe` - Get full recipe details
- `import_recipe` - Import from URL, text, or photo (copies the main image into Vercel Blob)
- `list_cookbooks` / `get_cookbook` / `manage_cookbook` - Organize recipes in many-to-many cookbooks
- `get_household_context` - Get household members and dietary rules
- `save_meal_plan` - Create or update a meal plan
- `check_meal_plan` - Run allergen and dietary rule checks
- `export_shopping_list` - Generate shopping list with quantities

[View full Bot Setup Guide →](bot-setup.md)

### CLI

Command-line interface for scripting and automation:

```bash
# Search recipes
ovenlovin recipes search "chicken pasta"

# Import a recipe
ovenlovin recipes import --url https://example.com/recipe

# Check a meal plan
ovenlovin plans check plan-123

# Export shopping list
ovenlovin plans shopping-list plan-123
```

## Contributing

OvenLovin is open source and welcomes contributions. See [AGENTS.md](../AGENTS.md) for development guidelines.

### For AI Agents

The [Agent Development Guide](../AGENTS.md) includes:
- Repository structure and tech stack
- Development commands
- Core principles and safety invariants
- Testing requirements
- Conventions and patterns
- How to add features (importers, MCP tools, REST endpoints, rule types)

### For Humans

- **Issues**: Report bugs or suggest features on [GitHub Issues](https://github.com/tbarho/ovenlovin/issues)
- **Pull Requests**: Submit PRs following the development guidelines
- **Discussions**: Join the conversation on GitHub Discussions

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Resources

- **GitHub**: [tbarho/ovenlovin](https://github.com/tbarho/ovenlovin)
- **Spec**: [GitHub Issue #1](https://github.com/tbarho/ovenlovin/issues/1)
- **Related Projects**: [ReciMe](https://recime.app), [Mealie](https://mealie.io)

---

Built with ❤️ for AI-powered family meal planning
