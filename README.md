<h1 align="center">
  <img src="packages/brand/assets/lockup.png" width="280" alt="OvenLovin" />
</h1>

<p align="center">
  <strong>The family recipe box your AI can actually use, and it knows who can't eat what.</strong>
</p>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&project-name=ovenlovin&repository-name=ovenlovin&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%2C%7B%22type%22%3A%22blob%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22clerk%22%2C%22productSlug%22%3A%22clerk%22%7D%5D&env=NEXT_PUBLIC_INSTANCE_NAME&envDescription=Optional%20instance%20name.%20USDA%20is%20optional%20and%20not%20required%20to%20deploy.%20On%20Vercel%2C%20AI%20Gateway%20uses%20OIDC%20-%20no%20AI_GATEWAY_API_KEY%20needed.%20Neon%2C%20Blob%2C%20and%20Clerk%20come%20from%20the%20stores%20step.%20If%20Clerk%20is%20not%20offered%2C%20set%20NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%20and%20CLERK_SECRET_KEY%20in%20Vercel.&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&demo-title=OvenLovin&demo-description=The%20family%20recipe%20box%20your%20AI%20can%20actually%20use&demo-url=https://ovenlovin.vercel.app)

Open-source recipe box and meal planner for families and their agents. Per-person allergen checks (US Big 9 + EU 14). Coconut is its own allergen - tree-nut rules leave it off unless `treatCoconutAsTreeNut` is set. MIT license.

> Not medical advice. Always read ingredient labels before serving.

<p align="center">
  <img src="docs/assets/kitchen-recipes.png" width="720" alt="OvenLovin recipes shelf" />
</p>

## Shipped

- **Recipes & cookbooks** - import a URL or paste, file dishes in cookbooks, cook from a photo-first shelf
- **People & rules** - Can't eat / Doesn't like / Loves, set by the household. Loves never hide a recipe
- **Who can eat this** - named per-person findings on every dish (`block` / `warn` / `prefer_avoid`)
- **Meal plan & list** - week view and shopping list, with the same per-person warnings
- **Agents** - REST `/api/v1` (API key or Clerk), MCP Streamable HTTP at `/mcp`, OpenAPI, `/llms.txt`
- **Auth & data** - Clerk organizations as households, Neon Postgres + Drizzle, Vercel Blob, Vercel AI Gateway
- **Import AI** - paste, photo, and URL extract use `deepseek/deepseek-v4.1-flash`. DeepSeek failures retry `openai/gpt-6-luna`. Overrides: `RK_MODEL_DEFAULT` (paste), `RK_MODEL_VISION` (photo), `RK_MODEL_EXTRACT` (URL; else `RK_MODEL_DEFAULT`)
- **Public demo** - no-signup sandbox kitchen (separate demo project; never on product production)

<p align="center">
  <img src="docs/assets/kitchen-recipe.png" width="340" alt="Recipe with who-can-eat" />
  &nbsp;
  <img src="docs/assets/kitchen-people.png" width="340" alt="Household people" />
</p>
<p align="center">
  <img src="docs/assets/kitchen-person.png" width="340" alt="Jake's peanut and tree nut blocks" />
  &nbsp;
  <img src="docs/assets/kitchen-settings.png" width="340" alt="API keys for agents" />
</p>

## Roadmap

- CLI, published SDK, voice import, and third-party app export
- USDA FoodData Central nutrition (optional `USDA_FDC_API_KEY` - not required to deploy)
- Native apps

## Connect your agent

1. Deploy your own copy (button above).
2. Sign in, open **Settings**, then **API keys**, create a key, and copy the `plaintext` value (shown once). Just looking? The public demo at https://ovenlovin-demo.vercel.app issues a 24h sandbox key at `/api/demo/enter?format=json`.
3. Point the agent at this instance:

```
MCP:     https://<your-app>/mcp
REST:    https://<your-app>/api/v1
OpenAPI: https://<your-app>/api/v1/openapi.json
Docs:    https://<your-app>/docs/connect-your-agent
llms.txt https://<your-app>/llms.txt
```

Authorization: `ApiKey rkapi_…` or `Bearer rkapi_…`.

## Deploy

The button provisions Neon, Blob, and Clerk. You may set an optional instance name. USDA is **not** required.

If Clerk is not offered as a store, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in Vercel.

On Vercel, AI Gateway uses OIDC - no `AI_GATEWAY_API_KEY`. See [DEPLOYMENT.md](./DEPLOYMENT.md) and [self-hosting](https://tbarho.github.io/ovenlovin/docs/self-hosting).

The public no-signup demo is a **separate Vercel project**. See [docs/demo.md](docs/demo.md) for env vars, cron, and project settings. Never set `OVENLOVIN_DEMO_MODE` on the product production project.

## Local development

Prereqs: Node 20+, pnpm 9 (`corepack enable`), Postgres 15+ or Docker. `git clone https://github.com/tbarho/ovenlovin && cd ovenlovin && cp .env.example apps/web/.env.local && pnpm install`. Start Postgres (`docker compose -f docker-compose.e2e.yml up -d`, or use your own at the URL below), then `export DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin && pnpm db:migrate`. Full guide: https://tbarho.github.io/ovenlovin/docs/quickstart

```bash
pnpm dev
pnpm test
```

`pnpm dev` starts the kitchen at http://localhost:3000 and docs at http://localhost:3001/ovenlovin/docs. Without env vars, pages load but sign-in and data do not; check http://localhost:3000/api/v1/status for what is missing.

Signed-in kitchen (no production Clerk):

Requires Docker (starts Postgres from docker-compose.e2e.yml) or an existing Postgres at postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin.

```bash
./scripts/e2e-kitchen-up.sh
E2E_AUTH_BYPASS=1 DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin \
  pnpm --filter @ovenlovin/web dev
```

See [`AGENTS.md`](./AGENTS.md) for agent/LLM guidelines.

## Architecture

```
ovenlovin/
├── apps/web/              # Next.js 15 kitchen + REST + MCP
├── apps/docs/             # Public docs site
└── packages/
    ├── core/              # Zod schemas and services
    ├── db/                # Drizzle + Postgres
    ├── mcp/               # MCP tools (thin adapters over core)
    ├── importers/         # URL / paste / photo / HTML import
    ├── allergens/         # Taxonomy + per-person rule checker
    └── brand/             # Wordmark, deploy URL, tokens
```

CLI and shared UI packages are not shipped.

## License

[MIT](./LICENSE)

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security](./SECURITY.md)
- [Changelog](./CHANGELOG.md)
