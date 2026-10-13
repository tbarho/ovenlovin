# Agent Development Guide

> **For LLMs and developer agents working on OvenLovin**

## Repository Structure

```
ovenlovin/
├── apps/
│   └── web/                    # Next.js App Router UI
├── packages/
│   ├── core/                   # Pure TypeScript business logic
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── vitest.config.ts
│   ├── db/                     # Drizzle schema & migrations (coming)
│   ├── mcp/                    # MCP server (coming)
│   ├── cli/                    # CLI tool (coming)
│   ├── importers/              # Recipe importers (coming)
│   ├── allergens/              # Allergen taxonomy & rule checker (coming)
│   └── ui/                     # Shared UI components (coming)
├── .github/workflows/          # CI pipelines
├── docs/                       # Documentation & research
├── turbo.json                  # Turborepo config
└── pnpm-workspace.yaml         # pnpm workspace config
```

## Tech Stack

- **Monorepo**: pnpm + Turborepo
- **Runtime**: Node.js ≥20
- **Language**: TypeScript 5.7+ (strict mode, noUncheckedIndexedAccess)
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Framework**: Next.js 15 (App Router)
- **Database**: Neon Postgres + Drizzle ORM
- **Auth**: Clerk (households = Organizations)
- **Storage**: Vercel Blob
- **AI**: Vercel AI Gateway + eve

## Development Commands

```bash
# Install
pnpm install

# Dev (all workspaces)
pnpm dev

# Dev (specific workspace)
pnpm --filter @ovenlovin/web dev
pnpm --filter @ovenlovin/core test:watch

# Build
pnpm build

# Test
pnpm test           # Run all tests
pnpm test:watch     # Watch mode

# Lint & format
pnpm lint
pnpm format
pnpm typecheck

# Clean
pnpm clean
```

## Core Principles

### 1. Business Logic in `@ovenlovin/core`

All business logic, validation, and services live in `packages/core` as pure TypeScript. REST APIs, MCP tools, CLI commands, and UI are thin adapters.

**Why**: External bots (Grok, ChatGPT, Claude) must get identical behavior through any interface.

### 2. Zod-first schemas

Every data structure starts as a zod schema. Use `zod-openapi` to generate OpenAPI specs.

### 3. Safety-critical: Per-person rule checking

Allergy and dietary restriction checking is safety-relevant. **Never**:

- Hard-code allergen policies (all rules are per-person, configured by the family admin)
- Silently hide recipes or ingredients
- Report "no issues" when checking cannot complete
- Skip reporting warnings to attendees

**Always**:

- Return per-person findings with severity (block/warn/prefer-avoid)
- Name the person, rule, ingredient, and reason in every warning
- Report `status: incomplete` with reasons if checking fails
- Store check reports with the plan content hash

### 4. Generic data only

No real family names, photos, or private data in fixtures, tests, or docs. Use generic examples:

- "Parent A", "Child B (age 9, soccer)"
- "Household 1"
- Public-domain or synthetic recipe content

### 5. Testing Requirements

- **Unit tests**: ingredient parsing, conversions, nutrition, allergen mapping, rule matching
- **Property-based tests** (fast-check): "a recipe with an ingredient matching a person's `block` rule always yields a `block` finding for that person"
- **Contract tests**: OpenAPI schema conformance, MCP tool schemas
- **Integration tests**: database access, auth, row-level security
- **E2E tests** (Playwright, when UI is ready): import → review → configure rules → plan → check → export

**CI gate**: all tests must pass, including the allergy/rule-checking suite.

## Conventions

- **IDs**: ULIDs or UUIDs
- **Timestamps**: `created_at`, `updated_at` (ISO 8601 UTC)
- **Soft delete**: `deleted_at` (nullable)
- **Creator tracking**: `created_by` (user or bot client ID)
- **Multi-household**: every entity has `household_id` where applicable
- **Enums**: prefer string literal unions over numeric enums
- **Units**: canonical enums (metric/US), rational quantity (min/max)
- **Errors**: descriptive messages with remediation hints
- **API**: cursor pagination, idempotency keys on writes, problem+json errors
- **Naming**: camelCase for variables/functions, PascalCase for types/components
- **Sheet-hosted inputs**: Never define a component inside another component’s render body — that remounts the tree (and blurs the field) on every keystroke. Keep `key` props stable; never use `Math.random()`, `Date.now()`, or the value being edited. Give each sheet a stable identity while it is open. Autofocus and focus-trap effects may depend only on `open`, not on inline `onClose` or draft state, so they run once when the sheet opens. Keep draft input state in the sheet form, not in a parent that rebuilds the sheet on every character.

## Safety Invariants (Do Not Break)

1. **Rule checking is deterministic** for the same inputs (recipe, attendees, rules)
2. **Warnings name the affected person** and are returned in every relevant API response (plan check, shopping list, household context)
3. **Recipe edits or rule changes mark affected plans as `needs_recheck`**
4. **Incomplete checks are reported as `status: incomplete`**, never "no issues"
5. **No hard-coded allergen policies**; all rules are per-person config set by the family admin

## Adding Features

### New importer

1. Create `packages/importers/src/<source>.ts`
2. Implement `Importer { canHandle, extract, toDraft }`
3. Add eval fixtures (input + expected output)
4. Add tests with recorded score

### New MCP tool

1. Define the tool in `packages/mcp/src/tools/<name>.ts`
2. Implement as a thin wrapper around `@ovenlovin/core` service
3. Add schema tests
4. Document in `docs/mcp-tools.md`

### New REST endpoint

1. Create route in `apps/web/src/app/api/v1/<resource>/route.ts`
2. Wrap `@ovenlovin/core` service
3. Generate OpenAPI schema from zod
4. Add contract tests

### New rule type

1. Add to `person_rule.kind` enum in schema
2. Implement matcher in `packages/allergens/src/matchers/<kind>.ts`
3. Add adversarial test fixtures (misspellings, plurals, OCR errors, aliases, hidden ingredients)
4. Ensure test suite includes one blocking test per supported allergen/ingredient

## Resources

- **Spec**: [GitHub issue #1](https://github.com/tbarho/ovenlovin/issues/1)
- **Schema** (coming): `docs/schema.md`
- **API docs** (coming): `docs/api.md`
- **MCP tools** (coming): `docs/mcp-tools.md`

## Questions?

See the spec in issue #1 or ask in the PR discussion.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
