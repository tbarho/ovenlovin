# Public demo mode

OvenLovin can run as a **separate Vercel project** of the same repo. Visitors skip Clerk, land in a private sample kitchen, and can connect an agent with a sandbox API key.

The product production project must never enter demo mode.

## How it works

1. `OVENLOVIN_DEMO_MODE=1` turns demo mode on.
2. On Vercel production, the dedicated demo project must also set `OVENLOVIN_DEMO_PROJECT=1`. If the product production project has `OVENLOVIN_DEMO_MODE` set, **the build fails**.
3. An uncookied kitchen visit redirects to `GET /api/demo/enter`, which copies the sample household into a private sandbox and sets the `ol_demo_sandbox` cookie (httpOnly, 24 hours): 5 people (rules + loves), ~20 recipes with images, two cookbooks, a meal plan, a shopping list, and one API key.
4. Writes are allowed but rate-limited (60/hour). Recipe imports are capped at 5. Only an acknowledged new save counts: preview (`save` omitted or false), duplicate/in-flight 409s, and idempotent retries do not increment the cap. Quota errors and successful saves include `remainingImports`. Image uploads are off. Photo import uses the same AI Gateway check as `/api/v1/status` (`AI_GATEWAY_API_KEY`, `VERCEL_OIDC_TOKEN`, or the Vercel runtime). If those are missing, both surfaces say so. URL import still works; paste import uses the local parser when the gateway is off.
5. Settings shows this sandbox's MCP URL (`/mcp`) and API key. MCP is **stateless HTTP**: each POST authenticates with the key and tools see the **key-derived household**. There is no MCP session id.
6. Nightly cron `GET /api/cron/demo-cleanup` (`0 8 * * *` UTC) wipes expired sandboxes. Production cron requests must send `Authorization: Bearer $CRON_SECRET` (Vercel injects this automatically when `CRON_SECRET` is set).

Demo logic lives in `apps/web/src/lib/demo/`. Do not fold it into Clerk or the e2e kitchen bypass.

## Local run

```bash
# Any local Postgres 16, then:
pnpm db:migrate
OVENLOVIN_DEMO_MODE=1 DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin \
  pnpm --filter @ovenlovin/web dev
```

Open `http://localhost:3000` - middleware sends you to `/api/demo/enter`, which seeds and redirects to `/recipes`.

## Product landing

After the demo project has a production URL, set `NEXT_PUBLIC_DEMO_URL` on the **product** Vercel project (not the demo project) so the main landing page shows **Try the demo**.

## Agent connect (browser)

On the demo deploy, open **Settings**:

- MCP URL: `https://<demo-host>/mcp`
- Header: `Authorization: ApiKey rkapi_…`

Claude / Grok should send that header on every MCP POST. There is no session id (stateless transport). Household comes from the key.

## Agent connect (test client, no browser)

`GET /api/demo/enter` seeds a sandbox and returns credentials when the client asks for JSON:

```bash
curl -sS -c /tmp/ol-demo.cookies \
  -H 'Accept: application/json' \
  'https://<demo-host>/api/demo/enter?format=json'
```

Response:

```json
{
  "ok": true,
  "mcpUrl": "https://<demo-host>/mcp",
  "apiKey": "rkapi_…",
  "authorization": "ApiKey rkapi_…",
  "householdId": "…",
  "expiresAt": "…",
  "transport": "stateless-http"
}
```

Then:

```bash
# Health (no auth)
curl -sS 'https://<demo-host>/mcp'

# Stateless MCP - household is derived from the key
curl -sS 'https://<demo-host>/mcp' \
  -H "Authorization: ApiKey $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo-test","version":"0.0.1"}}}'

curl -sS 'https://<demo-host>/mcp' \
  -H "Authorization: ApiKey $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

`Authorization: Bearer rkapi_…` is also accepted. Do not send `Mcp-Session-Id`.

REST uses the same key:

```bash
curl -sS 'https://<demo-host>/api/v1/recipes' \
  -H "Authorization: ApiKey $API_KEY"
```

---

## Vercel project setup (Corbin, using Ty's local CLI)

Do **not** add these flags to the existing product project (`ovenlovin`). Create a **new** Vercel project on the same GitHub repo.

Logged in as Ty (`vercel whoami` should be Ty's account / the `ty-barho` team):

```bash
cd /path/to/ovenlovin
vercel whoami

# Create the project (name must be new - not `ovenlovin`)
vercel project add ovenlovin-demo

# Link this checkout to the new project when prompted:
#   Set up “~/…/ovenlovin”? yes
#   Scope: ty-barho (or Ty's team)
#   Link to existing project? yes
#   Project: ovenlovin-demo
vercel link --yes --project ovenlovin-demo --scope ty-barho
```

Then in the Vercel dashboard for **ovenlovin-demo** (Project → Settings):

| Setting | Value |
| --- | --- |
| Git repository | `tbarho/ovenlovin` |
| Production Branch | `main` |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | leave default - `apps/web/vercel.json` already sets `cd ../.. && pnpm install --prod=false && pnpm turbo run build --filter=@ovenlovin/web... && pnpm exec tsx packages/db/src/migrate.ts` |
| Install Command | `pnpm install` |
| Output Directory | Next.js default (leave empty) |
| Node.js Version | `20.x` |
| Include files outside Root | on (monorepo) |

If the dashboard “Root Directory” UI is used, `apps/web/vercel.json` is picked up automatically (framework, build command, cron, function maxDuration).

### Cron

`apps/web/vercel.json` already declares:

```json
{
  "crons": [
    {
      "path": "/api/cron/demo-cleanup",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Confirm under Project → Settings → Cron Jobs after the first production deploy:

- Path: `/api/cron/demo-cleanup`
- Schedule: `0 8 * * *` (08:00 UTC daily)
- Method: `GET`
- Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var exists

Cron requires a Vercel plan that supports cron (Pro / the same plan as the product project). The same `vercel.json` cron is also present on the product project; the handler **404s** there because demo mode is off.

### Neon database

Create a **new** Neon project or a new database on the existing Neon account. **Do not reuse the product `DATABASE_URL`.** Demo sandboxes write `demo_sandbox` rows and visitor kitchens; mixing them with production households is unsafe.

`DATABASE_URL` must be present at **build and runtime** so `packages/db/src/migrate.ts` applies `0003_demo_sandbox`. If it is missing at build, migrations are skipped and the first visitor 500s.

### Environment variables (demo project)

Set all of these on **Production** (and Preview if you want preview deploys to demo). Values `1` and `true` are both accepted.

| Name | Environment | Value | Required |
| --- | --- | --- | --- |
| `OVENLOVIN_DEMO_MODE` | Production, Preview | `1` | **yes** |
| `OVENLOVIN_DEMO_PROJECT` | Production, Preview | `1` | **yes** on Vercel production (`VERCEL_ENV=production`) or the build/runtime treats this as the product host and demo stays off |
| `DATABASE_URL` | Production, Preview | Neon URL for the **demo** database, including at build time | **yes** |
| `CRON_SECRET` | Production | `openssl rand -hex 32` | **yes** on production or nightly cleanup returns 401 |
| `NEXT_PUBLIC_APP_URL` | Production | `https://<demo-production-host>` (no trailing slash) | recommended so Settings / JSON enter emit a stable MCP URL |
| `NEXT_PUBLIC_INSTANCE_NAME` | Production | `OvenLovin demo` (optional) | no |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Injected when a Blob store is connected to this project | **yes** for imported photos. Without it, URL import keeps the source-site image URL. Seeded `/demo-kitchen/*.svg` assets stay local. |

CLI (non-interactive; run from the linked checkout):

```bash
printf '1' | vercel env add OVENLOVIN_DEMO_MODE production --yes
printf '1' | vercel env add OVENLOVIN_DEMO_MODE preview --yes
printf '1' | vercel env add OVENLOVIN_DEMO_PROJECT production --yes
printf '1' | vercel env add OVENLOVIN_DEMO_PROJECT preview --yes

# Paste the demo Neon URL when prompted, or:
printf '%s' "$DEMO_DATABASE_URL" | vercel env add DATABASE_URL production --yes
printf '%s' "$DEMO_DATABASE_URL" | vercel env add DATABASE_URL preview --yes

CRON_SECRET="$(openssl rand -hex 32)"
printf '%s' "$CRON_SECRET" | vercel env add CRON_SECRET production --yes

# After the first production deploy, put the real host here:
printf '%s' 'https://ovenlovin-demo.vercel.app' | vercel env add NEXT_PUBLIC_APP_URL production --yes

# Preferred: Vercel dashboard → ovenlovin-demo → Storage → Create / Connect Blob
# (Production + Preview). That injects BLOB_READ_WRITE_TOKEN. Or paste a token:
printf '%s' "$BLOB_READ_WRITE_TOKEN" | vercel env add BLOB_READ_WRITE_TOKEN production --yes
printf '%s' "$BLOB_READ_WRITE_TOKEN" | vercel env add BLOB_READ_WRITE_TOKEN preview --yes
```

After adding the Blob token, **redeploy** ovenlovin-demo (Production). Existing imported recipes keep their hot-linked URLs; only new imports copy the main image.

If `vercel env add --yes` is not accepted by the installed CLI, omit `--yes` and confirm the prompts (Production / Preview, no git branch).

### Do **not** set on the demo project

| Name | Why |
| --- | --- |
| `E2E_AUTH_BYPASS` | Product production build fails if this is requested; not the demo path |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk is skipped in demo mode. Leaving them unset is fine. |
| `AI_GATEWAY_API_KEY` | Demo forces AI off. Setting a key does nothing useful and is extra attack surface. |
| Product `DATABASE_URL` | Isolates visitor kitchens from real households |

### Environment variables (product project - after demo is live)

| Name | Environment | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_URL` | Production | `https://<demo-production-host>` (no trailing slash) |

**Never** set `OVENLOVIN_DEMO_MODE` or `OVENLOVIN_DEMO_PROJECT` on the product project. `next build` calls `assertDemoModeSafeForBuild()` and fails product production if `OVENLOVIN_DEMO_MODE` is set without `OVENLOVIN_DEMO_PROJECT=1`.

### Deploy

```bash
# From the linked checkout, or rely on GitHub: pushing main already deploys
# the product project. For the new project, connect the same repo in the
# dashboard (Settings → Git) so `main` builds ovenlovin-demo as well.
vercel --prod --yes
```

First production build must see `DATABASE_URL` so `0003_demo_sandbox` applies. Redeploy after adding env vars if the first build skipped migrations.

### Smoke after deploy

1. `curl -sS https://<demo-host>/mcp` → `{ "transport": "stateless-http", "auth": "ApiKey or Bearer rkapi_", … }`
2. `curl -sS -H 'Accept: application/json' https://<demo-host>/api/demo/enter?format=json` → `rkapi_` key + `mcpUrl`
3. MCP `initialize` + `tools/list` with `Authorization: ApiKey <key>` (see above)
4. Open `/recipes` in a browser → banner “Demo, resets daily”, 5 people, ~20 recipes
5. Open `/settings` → same MCP URL and key
6. Confirm product production still has **no** demo flags and still 404s `/api/cron/demo-cleanup`
