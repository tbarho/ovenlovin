# Deployment Guide

## Vercel Configuration

The project is configured to deploy on Vercel with the following setup:

### Project Settings

In the Vercel dashboard, configure:

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js
- **Build Command**: Uses the custom command from `apps/web/vercel.json`
- **Output Directory**: (leave empty, Next.js default)

The `apps/web/vercel.json` file contains:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm install --prod=false && pnpm turbo run build --filter=@ovenlovin/web... && pnpm exec tsx packages/db/src/migrate.ts"
}
```

This build command:
1. Goes to the repository root
2. Installs all dependencies
3. Uses Turborepo to build `@ovenlovin/web` and all its workspace dependencies
4. Runs database migrations (`db:migrate:deploy`). If the schema already exists from `drizzle-kit push` and Drizzle has no history, the script baselines `drizzle.__drizzle_migrations` instead of re-applying the initial SQL.

### Environment Variables

The Deploy button provisions Neon, Blob, and Clerk via the `stores` parameter. Configure anything missing in the Vercel dashboard (Settings → Environment Variables):

#### Provisioned by stores
- `DATABASE_URL` - Neon Postgres connection string (a non-pooled `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` is used for migrations when present)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` - Clerk (set these manually if the Clerk store is not offered)

#### Prompted on clone
- `NEXT_PUBLIC_INSTANCE_NAME` - optional landing-page name (defaults to "Your OvenLovin")

#### Optional
- `USDA_FDC_API_KEY` - USDA FoodData Central. Not required to deploy.
- `AI_GATEWAY_API_KEY` - only needed off Vercel; on Vercel, AI Gateway uses OIDC
- `RK_MODEL_EXTRACT` - optional URL-import text model after JSON-LD/HTML miss. Default `openai/gpt-4o-mini`. No new Vercel key required; uses the existing gateway.
- `NEXT_PUBLIC_APP_URL` - Base URL for the app (auto-set by Vercel)
- `OVENLOVIN_VERCEL_TEAM_SLUG` - Vercel team/account slug for dashboard links (not the GitHub owner; example: `ty-barho`)
- `OVENLOVIN_VERCEL_PROJECT_SLUG` - Vercel project slug if it differs from the git repo name
- `VERCEL_TOKEN` / `OVENLOVIN_VERCEL_TOKEN` - optional; used to resolve the team/project slugs from `VERCEL_PROJECT_ID` when the overrides are unset. Without slugs or a token, links fall back to https://vercel.com/dashboard
- `RECIPE_IMPORT_HEADLESS` - optional; `0` disables headless Chromium for URL import (default on). No paid proxy required. On Vercel, `@sparticuz/chromium-min` fetches a public pack at runtime (raise function memory in the dashboard if needed; Fluid does not allow `memory` in `vercel.json`). Public copies run first so Chromium does not burn the time budget.
- `RECIPE_IMPORT_CACHE_FALLBACK` - optional; `0` disables public copies (Wayback identity, Jina Reader, Google Translate). Default on. No API key.
- `RECIPE_IMPORT_SCRAPE` - optional; `0` disables a configured remote browser. Default on when a provider is set.
- `BROWSERLESS_URL` / `BROWSERLESS_TOKEN` - optional Browserless Chromium. Not configured here; needs Ty's OK before adding to Vercel.
- `SCRAPINGBEE_API_KEY` - optional ScrapingBee. Not configured here; needs Ty's OK before adding to Vercel.
- `RECIPE_IMPORT_SCRAPE_URL` / `RECIPE_IMPORT_SCRAPE_TOKEN` - optional custom `POST { url }` HTML endpoint.
- `RECIPE_IMPORT_CHROME_PATH` - optional local Chrome path off Vercel.
- `RECIPE_IMPORT_CHROMIUM_PACK_URL` - optional override for the public Chromium pack URL used on Vercel.

### Database Migrations

Migrations run automatically on every Vercel build. To run them locally:

```bash
# Same script Vercel uses (baselines push-created databases)
DATABASE_URL="your-production-db-url" pnpm --filter @ovenlovin/db db:migrate:deploy

# Or Drizzle Kit directly
npx vercel env pull .env.local
pnpm --filter @ovenlovin/db db:migrate
```

### Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&project-name=ovenlovin&repository-name=ovenlovin&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%2C%7B%22type%22%3A%22blob%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22clerk%22%2C%22productSlug%22%3A%22clerk%22%7D%5D&env=NEXT_PUBLIC_INSTANCE_NAME&envDescription=Optional%20instance%20name.%20USDA%20is%20optional%20and%20not%20required%20to%20deploy.%20On%20Vercel%2C%20AI%20Gateway%20uses%20OIDC%20-%20no%20AI_GATEWAY_API_KEY%20needed.%20Neon%2C%20Blob%2C%20and%20Clerk%20come%20from%20the%20stores%20step.%20If%20Clerk%20is%20not%20offered%2C%20set%20NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%20and%20CLERK_SECRET_KEY%20in%20Vercel.&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform&demo-url=https://ovenlovin.vercel.app)

When deploying via the button:
1. Click the button above
2. Create a Vercel account or sign in
3. Accept the Neon, Blob, and Clerk stores (or connect existing ones)
4. Enter an optional instance name (USDA is optional; AI Gateway uses OIDC on Vercel)
5. Deploy - migrations run as part of the build

After deployment:
1. Verify the homepage loads: `https://your-project.vercel.app`
2. Check API health: `https://your-project.vercel.app/api/v1/health`
3. Check config status: `https://your-project.vercel.app/api/v1/status`
4. Test OpenAPI spec: `https://your-project.vercel.app/api/v1/openapi.json`

### Troubleshooting

#### Build Fails
- Check environment variables are set
- Verify DATABASE_URL is accessible from Vercel
- Check build logs: `npx vercel inspect <deployment-id> --logs`

#### 404 Errors
- Ensure Root Directory is set to `apps/web`
- Verify Framework Preset is Next.js
- Check `apps/web/vercel.json` exists in the repository

#### Database Connection Errors
- Verify DATABASE_URL format includes `?sslmode=require`
- Check Neon database allows connections from Vercel
- Ensure migrations have been run

## Public demo project

The public no-signup demo is a **second Vercel project** of this repo. Do not set demo flags on the product production project.

See [docs/demo.md](docs/demo.md) for runtime behavior. Corbin/Ty: exact `vercel` commands and env vars are in the pull request that lands this.

## Local Development

```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your local values

# Install dependencies
pnpm install

# Run database migrations
pnpm --filter @ovenlovin/db db:migrate

# Start development server
pnpm dev
```

Access at `http://localhost:3000`

## Production Checklist

Before going to production:

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] Clerk authentication tested
- [ ] AI import features tested
- [ ] OpenAPI spec accessible
- [ ] MCP endpoint returns 200 or 401 (not 404)
- [ ] Error monitoring configured (e.g., Sentry)
- [ ] Rate limiting configured
- [ ] CORS policies reviewed
