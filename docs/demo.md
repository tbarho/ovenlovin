# Public demo mode

OvenLovin can run as a **separate Vercel project** of the same repo. Visitors skip Clerk, land in a private sample kitchen, and can connect an agent with a sandbox API key.

The product production project must never enter demo mode.

## How it works

1. `OVENLOVIN_DEMO_MODE=1` turns demo mode on.
2. On Vercel production, the dedicated demo project must also set `OVENLOVIN_DEMO_PROJECT=1`. If the product production project has `OVENLOVIN_DEMO_MODE` set, **the build fails**.
3. Each visitor gets an `ol_demo_sandbox` cookie (httpOnly, 24 hours). The first request copies the sample household into a private sandbox: 5 people (rules + loves), ~20 recipes with images, two cookbooks, a meal plan, a shopping list, and one API key.
4. Writes are allowed but rate-limited (60/hour). Recipe imports are capped at 5. Image uploads are off. AI calls are off (`isAiGatewayConfigured` is forced false).
5. Settings shows this sandbox's MCP URL (`/mcp`) and API key. MCP is stateless: each POST authenticates and tools see the **key-derived household**.
6. Nightly cron `GET /api/cron/demo-cleanup` (08:00 UTC) wipes expired sandboxes.

Demo logic lives in `apps/web/src/lib/demo/`. Do not fold it into Clerk or the e2e kitchen bypass.

## Local run

```bash
# Any local Postgres 16, then:
pnpm db:migrate
OVENLOVIN_DEMO_MODE=1 DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin \
  pnpm --filter @ovenlovin/web dev
```

Open `http://localhost:3000` — demo mode redirects `/` to `/recipes` and seeds a sandbox.

## Product landing

Set `NEXT_PUBLIC_DEMO_URL` on the **product** Vercel project (not the demo project) so the main landing page shows **Try the demo**.

## Agent connect

On the demo deploy, open **Settings**:

- MCP URL: `https://<demo-host>/mcp`
- Header: `Authorization: ApiKey rkapi_…`

Claude / Grok should send that header on every MCP POST. There is no session id (stateless transport).
