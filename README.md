# OvenLovin

> **LLM-optimized recipe and family meal-planning platform**

An open-source Next.js template for Vercel that provides a bot-first backend for recipe management, meal planning, and grocery lists. Built for AI agents (Grok Bot, ChatGPT, Claude) to help families manage weekly meal planning with per-person dietary rules and allergy checking.

## Status

🚧 **Pre-alpha** · Under active development

This is the foundation PR. See [GitHub issue #1](https://github.com/tbarho/ovenlovin/issues/1) for the full spec.

## Features (Planned)

- 📖 **Recipe management** with exhaustive import support (URL, photo/OCR, voice, paste, app exports)
- 👨‍👩‍👧‍👦 **Households & people** with per-person dietary rules (allergies, restrictions) and severities (block/warn/prefer-avoid)
- 📅 **Meal planning** with rule checking and schedule constraints
- 🛒 **Shopping lists** with aggregated ingredients and rule warnings
- 🤖 **Bot interfaces**: REST + OpenAPI, remote MCP server, CLI
- 🏥 **USDA FoodData Central** integration for nutrition data
- 🔐 **Clerk auth** with organizations (households)
- 🗄️ **Neon Postgres + Drizzle ORM**
- ☁️ **Vercel AI Gateway + eve** for all AI operations

## Architecture

**Monorepo** (pnpm + Turborepo):

```
ovenlovin/
├── apps/
│   └── web/          # Next.js App Router
└── packages/
    ├── core/         # Business logic, zod schemas, services
    ├── db/           # Drizzle schema & migrations
    ├── mcp/          # MCP server
    ├── cli/          # CLI tool
    ├── importers/    # Recipe importers
    ├── allergens/    # Allergen taxonomy & checker
    └── ui/           # Shared UI components
```

## Quick Start

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftbarho%2Fovenlovin&root-directory=apps/web)

### Local Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Run tests
pnpm test

# Lint & format
pnpm lint
pnpm format
```

## Development

See [`AGENTS.md`](./AGENTS.md) for agent/LLM development guidelines.

## License

[MIT](./LICENSE)

## Related

- Spec: [GitHub issue #1](https://github.com/tbarho/ovenlovin/issues/1)
- Inspired by: [ReciMe](https://recime.app), [Mealie](https://mealie.io)
