# Agent Guide

For coding agents (Claude Code, Codex, Cursor) and humans working on OvenLovin: the family recipe box your AI can use, with per-person allergen checks. Rules here are enforced by CI or by review; nothing is optional.

## Quick start

Prereqs: Node 20+, pnpm 9 (`corepack enable`), Docker (or a Postgres 16 at the URL below).

```bash
pnpm setup:local   # install, copy .env.example to apps/web/.env.local if missing, start Postgres, migrate, seed (with real photos)
pnpm dev:local     # signed-in kitchen at http://localhost:3000 (E2E_AUTH_BYPASS=1, local DATABASE_URL)
```

What `setup:local` runs, if you need the pieces:

```bash
pnpm install
cp .env.example apps/web/.env.local
./scripts/e2e-kitchen-up.sh   # docker compose postgres:16 on 5432, pnpm db:migrate, seeds the e2e household
# E2E_KITCHEN_PHOTOS=1 seeds hotlinked Unsplash photos instead of the local SVGs (dev only;
# CI and e2e keep the SVGs so they never need the network). setup:local and dev:local set it.
# It only replaces untouched fixture SVGs; to go back to SVGs, reset the DB
# (docker compose -f docker-compose.e2e.yml down -v, then pnpm setup:local without the flag).
```

Full local seed: `setup:local` also sets `E2E_KITCHEN_FULL=1`, which makes `seed-e2e-kitchen.ts` (and only that script, never the per-request bypass path) add `apps/web/src/lib/e2e-kitchen-full.ts`: 19 more recipes (warn / diet / coconut cases, a needs_review and a draft recipe, a soft-deleted one for `restore`, imageless, url and pdf sourced), 3 more people with warn / diet / dated rules, a "Holiday baking" cookbook, an approved last week with a check report and shopping state, a next week with undo history, a schedule, scoped and revoked API keys, and a second kitchen (`e2e-lake-house`: Ty admin, Sam owner, Nana viewer, a pending invite). It is idempotent. Never set it when running `pnpm e2e:kitchen`: the specs assert one kitchen, no pending invites, and the base recipe list.

Smoke check after `dev:local`: `/recipes`, `/people`, `/api/v1/openapi.json`, and `/llms.txt` return 200. `/api/v1/status` lists which env vars are missing.

What needs keys (all optional for local work):

- Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`): real sign-in. Without them, `E2E_AUTH_BYPASS=1` is the only way to see signed-in pages.
- `AI_GATEWAY_API_KEY`: URL / paste / photo import AI.
- `BLOB_READ_WRITE_TOKEN`: image uploads.
- No Docker: point `DATABASE_URL` at any Postgres 16, then `pnpm db:migrate && pnpm e2e:kitchen:seed`.

`pnpm dev` (no `:local`) starts every workspace: web on 3000, docs on 3001, mcp tsup watch. Without env vars, pages load but sign-in and data do not.

## Verify before you are done

CI (`.github/workflows/ci.yml`) runs exactly these. Run the ones that match what you touched; run all of them before opening a PR.

| Command                              | When                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `pnpm typecheck`                     | Any TS change                                               |
| `pnpm test`                          | Any code change (~1840 tests, 9 turbo tasks, ~1 min)        |
| `pnpm lint`                          | Any TS/TSX change                                           |
| `pnpm format:check`                  | Always (prettier; `pnpm format` fixes)                      |
| `pnpm lint:dashes`                   | Any text change (no em/en dashes in tracked files)          |
| `pnpm build`                         | Next.js routes, `next.config`, `vercel.json`, package exports |
| `pnpm e2e:kitchen`                   | UI changes under `apps/web` (Playwright, needs the DB up)   |

Notes:

- Single package: `pnpm --filter @ovenlovin/core test`, `pnpm --filter @ovenlovin/web test -- src/lib/jobs.test.ts`.
- `packages/core/src/jobs/queue.test.ts` needs `TEST_DATABASE_URL` (a migrated, separate DB). It skips locally without it and is required in CI. To run it: `TEST_DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin_test`, with that DB migrated via `DATABASE_URL=<same> pnpm db:migrate`.
- `pnpm e2e:kitchen` starts its own `next dev` on port 3100 and reseeds the DB (`--fresh-book --fresh-shot`) in global setup. It is safe alongside a dev server on 3000, but seeded data you edited is reset. Screenshots land in `e2e-artifacts/kitchen/<E2E_SHOT_LABEL>/` (gitignored). First run: `pnpm --filter @ovenlovin/web exec playwright install chromium`.
- Touched `apps/docs`? The link-check workflow runs `pnpm --filter @ovenlovin/docs build` then `node scripts/check-docs-links.mjs`.
- Prettier ignores `*.md` and `pnpm-lock.yaml` (`.prettierignore`). `lint:dashes` does not: it scans every tracked text file.

## Repo map

```
apps/web/                Next.js 15 App Router: UI, REST /api/v1, MCP at /mcp, cron routes
  src/app/api/v1/        REST routes (route.ts per resource), openapi.json route, route.test.ts next to each
  src/app/api/cron/      jobs-worker, jobs-sweep, demo-cleanup (CRON_SECRET auth, src/lib/cron-auth.ts)
  src/app/mcp/route.ts   MCP Streamable HTTP endpoint (wraps @ovenlovin/mcp)
  src/lib/api/           problem+json errors, auth middleware, OpenAPI generation (openapi-paths.ts)
  src/lib/e2e-auth.ts    E2E_AUTH_BYPASS gate      src/lib/demo/   OVENLOVIN_DEMO_MODE sandbox
  src/lib/e2e-kitchen.ts seeded UAT household      src/lib/jobs.ts in-process job worker kick
  e2e/kitchen/           Playwright signed-in kitchen spec + global-setup (reseeds)
  scripts/               seed-e2e-kitchen.ts, seed-demo-kitchen.ts, export-openapi.ts (prebuild)
apps/docs/               Public docs site (fumadocs). MCP tool reference: src/content/docs/reference/mcp/*.mdx
packages/core/           Zod schemas, services (packages/core/src/services), auth scopes, jobs queue. All business logic
packages/db/             Drizzle schema (src/schema/*.ts), SQL migrations (drizzle/NNNN_*.sql), migrate.ts, client.ts
packages/allergens/      Taxonomy, ingredient mapping, per-person rule checker, property + adversarial tests
packages/importers/      URL / paste / photo / HTML importers + eval fixtures
packages/import-evals/   eve-based import evals (pnpm eval:import, needs AI_GATEWAY_API_KEY)
packages/mcp/            MCP tools (src/tools/*.ts, registry.ts), JSON-RPC + protocol; the one package with a build (tsup)
packages/brand/          Wordmark, deploy URL, tokens
docs/                    Markdown docs: architecture.md, rules.md, mcp-tools.md, demo.md, bot-setup.md
scripts/                 e2e-kitchen-up.sh, check-no-em-en-dashes.mjs, check-docs-links.mjs
```

Dependency direction: `db` <- `core` <- `allergens` / `importers` <- `mcp` <- `web`. Packages are consumed as TypeScript source (`main: ./src/index.ts`); only `@ovenlovin/mcp` has a build step. Add new `@ovenlovin/core` entry points to its `exports` map in `packages/core/package.json`.

Stack: pnpm + Turborepo, TypeScript strict with `noUncheckedIndexedAccess`, Vitest (+ fast-check), Playwright, ESLint + Prettier, Next.js 15, Postgres via Drizzle + postgres-js (Neon in prod), Clerk (households = organizations), Vercel Blob, Vercel AI Gateway.

## Hard rules

Security and production:

- `E2E_AUTH_BYPASS` (`apps/web/src/lib/e2e-auth.ts`) is only active when `NODE_ENV=test` or `E2E_AUTH_BYPASS=1`, never when `VERCEL_ENV=production` (or `VERCEL=1` + `NODE_ENV=production`). `next build` calls `assertE2eAuthBypassSafeForBuild()` and a Vercel production build fails if the bypass is requested. `e2e-auth.test.ts` locks that gate. Never set `E2E_AUTH_BYPASS` in Vercel production env vars. Never use production Clerk credentials for QA.
- `OVENLOVIN_DEMO_MODE=1` is a separate no-signup deploy (`apps/web/src/lib/demo/`, `docs/demo.md`). Product Vercel production must never enable it; the build fails unless `OVENLOVIN_DEMO_PROJECT=1` on the dedicated demo project. First demo visit goes through `GET /api/demo/enter`, which sets the sandbox cookie; never `cookies().set` from a Server Component.
- `/prototype/*` and `/dev/people-preview` (`apps/web/src/lib/dev-routes.ts`) are never served on the production host.

Allergen and rule checking (safety-critical):

- Never hard-code allergen policies. All rules are per-person, configured by the household admin.
- Never silently hide recipes or ingredients. Loves never hide a recipe.
- Never report "no issues" when checking cannot complete: return `status: incomplete` with reasons.
- Always return per-person findings with severity (`block` / `warn` / `prefer_avoid`) naming the person, rule, ingredient, and reason, in every relevant response (plan check, shopping list, household context).
- Rule checking is deterministic for the same inputs. Check reports are stored with the plan content hash. Recipe edits or rule changes mark affected plans `needs_recheck`.
- Coconut is its own allergen: tree-nut rules exclude it unless `treatCoconutAsTreeNut` is set.
- Every allergen/rule change ships with tests. The suite keeps one blocking test per supported allergen.

Code placement:

- Business logic, validation, and services live in `@ovenlovin/core`. REST routes, MCP tools, and UI are thin adapters, so every interface behaves identically.
- Every data structure starts as a zod schema; OpenAPI is generated from zod (`@asteasolutions/zod-to-openapi`).

Data and text:

- No real family names, photos, or private data in fixtures, tests, or docs. Use "Parent A", "Child B (age 9, soccer)", "Household 1", synthetic recipes. The e2e kitchen seed (`apps/web/src/lib/e2e-kitchen.ts`) is the one exception, for visual UAT only.
- No em dashes (U+2014) or en dashes (U+2013) anywhere. Use `-` or spaced ` - `. CI fails otherwise.
- Conventional Commits (`feat(web): ...`, `fix(mcp): ...`). Small, focused PRs.

## Conventions (not linted)

- IDs: ULIDs or UUIDs. Timestamps `created_at` / `updated_at` (ISO 8601 UTC). Soft delete via `deleted_at`. `created_by` is a user or bot client id. Every household-owned entity carries `household_id`.
- Enums: string literal unions, never numeric enums. Units: canonical enums (metric/US), rational quantities (min/max).
- Errors: descriptive messages with remediation hints. API errors are problem+json (RFC 9457, `apps/web/src/lib/api/errors.ts`).
- API: cursor pagination on lists, `Idempotency-Key` on writes, auth `ApiKey rkapi_...` / `Bearer rkapi_...` / Clerk JWT. Resource ids from another kitchen 404 (see `resource-ownership.test.ts`).
- Naming: camelCase for variables and functions, PascalCase for types and components.
- Sheet-hosted inputs: never define a component inside another component's render body (it remounts and blurs the field on every keystroke). Keep `key` props stable; never `Math.random()`, `Date.now()`, or the value being edited. Give each sheet a stable identity while open. Autofocus and focus-trap effects depend only on `open`, not on inline `onClose` or draft state. Keep draft input state in the sheet form, not in a parent that rebuilds the sheet per character.
- Motion: animate only to convey meaning (state change, sheet/dialog enter/exit, reorder feedback, add/remove confirmation). No decorative motion (hover bounces, staggered entrances, pulses, press-scale). Use the tokens in `apps/web/src/app/globals.css` (`--motion-fast`, `--motion-base`, `--motion-sheet`, `--motion-ease`) and `apps/web/src/lib/motion.ts`. `prefers-reduced-motion` collapses durations globally.
- MCP tool results: images are thumbnail URLs only, never inline `data:` bytes.

## Common tasks

Add a migration:

```bash
# 1. edit packages/db/src/schema/<table>.ts
DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin pnpm --filter @ovenlovin/db db:generate
# 2. review packages/db/drizzle/NNNN_<name>.sql and meta/_journal.json (commit both)
pnpm db:migrate   # runs packages/db/src/migrate.ts, the same script Vercel runs at build
```

`migrate.ts` baselines a database created by `drizzle-kit push` instead of re-applying `0000`. Prefer `db:generate` + `db:migrate` over `db:push`.

Add a REST endpoint:

1. `apps/web/src/app/api/v1/<resource>/route.ts`, a thin wrapper over a `@ovenlovin/core` service.
2. Add the scope to `requiredRestScope` in `packages/core/src/auth/api-key-scopes.ts` (`scopes-table.test.ts` fails for any exported method without one).
3. Register the path in `apps/web/src/lib/api/openapi-paths.ts` (`openapi.test.ts` checks the document).
4. `route.test.ts` beside the route, including a cross-kitchen 404 case for id routes.

Add an MCP tool:

1. `packages/mcp/src/tools/<name>.ts`, thin wrapper over the same core service.
2. Add it to `MCP_TOOLS` in `packages/mcp/src/tools/registry.ts` and export from `packages/mcp/src/index.ts`.
3. Schema tests in `packages/mcp/src/tools.test.ts`.
4. Document in `docs/mcp-tools.md` and `apps/docs/src/content/docs/reference/mcp/<name>.mdx`.

Add an importer: `packages/importers/src/importers/<source>.ts` implementing `Importer { canHandle, extract, toDraft }`, eval fixtures (input + expected output), tests with a recorded score.

Add a rule type: add to the `person_rule.kind` enum in the schema, implement the matcher in `packages/allergens`, add adversarial fixtures (misspellings, plurals, OCR errors, aliases, hidden ingredients) and one blocking test per supported allergen or ingredient.

Add a test: `*.test.ts` next to the source (Vitest, `globals: true`). `*.test.tsx` runs under jsdom in `apps/web`. Property tests use fast-check (`packages/allergens/src/property.test.ts`). Contract tests: OpenAPI conformance and MCP tool schemas. Browser tests go in `apps/web/e2e/`.

## Gotchas

- DB connections: the app shares one postgres-js pool per `DATABASE_URL` on `globalThis` (`packages/db/src/client.ts`) because Next dev gives each route bundle its own module copy. `migrate.ts`, seed scripts, drizzle-kit, and Playwright global setup each open their own process and connection.
- Allergen matches are cached in two levels. The in-memory LRU (`packages/allergens/src/ingredient-mapping.ts`) always runs. Vercel Runtime Cache sits behind it only when `VERCEL_ENV` is `production` or `preview` and `VERCEL_DEPLOYMENT_ID` is set (`apps/web/src/lib/ingredient-match-store.ts`); local dev and tests are memory-only. Entries are namespaced per deployment, so a matcher change never reads old results. Call `warmIngredientMatches` before a server-side check. Module state shared across route bundles lives on `globalThis`, and recipe eviction is registered in `apps/web/src/instrumentation.ts`.
- Background jobs (photo import, book PDF) run in-process: a request calls `after()` and `kickWorker()` POSTs to `/api/cron/jobs-worker` on the same origin. The books feature is gated by `OVENLOVIN_BOOKS=1` (`apps/web/src/lib/jobs.ts`); the Playwright config sets it.
- `apps/web` `prebuild` exports the OpenAPI spec into `apps/docs/src/content/api/openapi.json` (skipped when `apps/docs` is absent). Rebuild after API changes before touching docs.
- Import AI defaults to `deepseek/deepseek-v4.1-flash`, with `openai/gpt-6-luna` as retry. Overrides: `RK_MODEL_DEFAULT`, `RK_MODEL_VISION`, `RK_MODEL_EXTRACT`. Vercel uses OIDC, so `AI_GATEWAY_API_KEY` is only needed off Vercel.
- Turbo `test`, `lint`, and `typecheck` depend on `^build`, so `@ovenlovin/mcp` gets built first. `passThroughEnv` is limited to `CI` and `TEST_DATABASE_URL` for `test`; other env vars do not reach tests through turbo.
- `apps/docs` typecheck and build run `scripts/fix-source-types.sh` first; `apps/docs/.source/` is generated and gitignored.
- `pnpm clean` removes root `node_modules` and `.turbo`; rerun `pnpm install` after.
- Playwright kitchen tests default to port 3100 and reuse a server there unless `CI` is set; `PLAYWRIGHT_BASE_URL` targets an existing server instead.

## Resources

- Spec: [GitHub issue #1](https://github.com/tbarho/ovenlovin/issues/1)
- Architecture: `docs/architecture.md`. Rules and allergen semantics: `docs/rules.md`. MCP tools: `docs/mcp-tools.md`. Demo project: `docs/demo.md`.
- Public docs: https://tbarho.github.io/ovenlovin/ (source in `apps/docs`). REST details: `apps/web/src/app/api/v1/README.md`. Deploy: `DEPLOYMENT.md`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
