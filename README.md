<p align="center">
  <img src="packages/brand/assets/mark.svg" width="128" alt="OvenLovin" />
</p>

<h1 align="center">OvenLovin</h1>

<p align="center">
  <strong>LLM-optimized recipe and family meal-planning platform</strong>
</p>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&env=DATABASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,BLOB_READ_WRITE_TOKEN,AI_GATEWAY_API_KEY,USDA_FDC_API_KEY&envDescription=Required%20API%20keys%20and%20connection%20strings%20for%20OvenLovin&envLink=https://github.com/tbarho/ovenlovin/blob/main/docs/bot-setup.md&project-name=ovenlovin&repository-name=ovenlovin&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform&demo-url=https://github.com/tbarho/ovenlovin&demo-image=https://vercel.com/api/www/avatar?u=ovenlovin&s=128&integration-ids=oac_nEXJBbvUWwjlcyqXeFz6ybeh)

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

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&env=DATABASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,BLOB_READ_WRITE_TOKEN,AI_GATEWAY_API_KEY,USDA_FDC_API_KEY&envDescription=Required%20API%20keys%20and%20connection%20strings%20for%20OvenLovin&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&project-name=ovenlovin&repository-name=ovenlovin&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform&demo-url=https://github.com/tbarho/ovenlovin&demo-image=https://vercel.com/api/www/avatar?u=ovenlovin&s=128&integration-ids=oac_nEXJBbvUWwjlcyqXeFz6ybeh)

The one-click deploy will:
- Clone this repository to your GitHub account
- Create a new Vercel project
- Connect a Neon Postgres database (auto-configured `DATABASE_URL`)
- Prompt for required API keys and secrets
- Deploy the Next.js app with all environment variables

### Required Environment Variables

- `DATABASE_URL` - Neon Postgres connection string (auto-configured if using Neon integration)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key ([get one](https://clerk.com))
- `CLERK_SECRET_KEY` - Clerk secret key
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token ([create one](https://vercel.com/docs/storage/vercel-blob))
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway API key ([create one](https://vercel.com/docs/ai))
- `USDA_FDC_API_KEY` - USDA FoodData Central API key ([get one](https://fdc.nal.usda.gov/api-key-signup.html))

See the [self-hosting documentation](https://tbarho.github.io/ovenlovin/docs/self-hosting) for detailed configuration instructions.

## Quick Start (Local Development)

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
