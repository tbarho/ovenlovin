<p align="center">
  <img src="packages/brand/assets/mark.png" width="128" alt="OvenLovin" />
</p>

<h1 align="center">OvenLovin</h1>

<p align="center">
  <strong>LLM-optimized recipe and family meal-planning platform</strong>
</p>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&project-name=ovenlovin&repository-name=ovenlovin&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%2C%7B%22type%22%3A%22blob%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22clerk%22%2C%22productSlug%22%3A%22clerk%22%7D%5D&env=AI_GATEWAY_API_KEY,USDA_FDC_API_KEY,NEXT_PUBLIC_INSTANCE_NAME&envDescription=AI%20Gateway%2C%20USDA%2C%20and%20optional%20instance%20name.%20Neon%2C%20Blob%2C%20and%20Clerk%20come%20from%20the%20stores%20step.%20If%20Clerk%20is%20not%20offered%2C%20set%20NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%20and%20CLERK_SECRET_KEY%20in%20Vercel.&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform&demo-url=https://ovenlovin.vercel.app)

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

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&project-name=ovenlovin&repository-name=ovenlovin&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%2C%7B%22type%22%3A%22blob%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22clerk%22%2C%22productSlug%22%3A%22clerk%22%7D%5D&env=AI_GATEWAY_API_KEY,USDA_FDC_API_KEY,NEXT_PUBLIC_INSTANCE_NAME&envDescription=AI%20Gateway%2C%20USDA%2C%20and%20optional%20instance%20name.%20Neon%2C%20Blob%2C%20and%20Clerk%20come%20from%20the%20stores%20step.%20If%20Clerk%20is%20not%20offered%2C%20set%20NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%20and%20CLERK_SECRET_KEY%20in%20Vercel.&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform&demo-url=https://ovenlovin.vercel.app)

The one-click deploy will:
- Clone this repository to your GitHub account
- Create a new Vercel project
- Provision Neon Postgres, Vercel Blob, and Clerk via the stores step
- Prompt for AI Gateway, USDA, and an optional instance name
- Run database migrations during the Vercel build (safe if the schema was previously created with `drizzle-kit push`)
- Deploy the Next.js app

If the Clerk store is not offered, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the Vercel project.

### Environment Variables

Provisioned by the stores step (you should not need to paste these):

- `DATABASE_URL` — Neon Postgres
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk

You will be prompted for:

- `AI_GATEWAY_API_KEY` — Vercel AI Gateway ([create one](https://vercel.com/docs/ai))
- `USDA_FDC_API_KEY` — USDA FoodData Central ([get one](https://fdc.nal.usda.gov/api-key-signup.html))
- `NEXT_PUBLIC_INSTANCE_NAME` — optional name shown on the landing page (defaults to "Your OvenLovin")

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
