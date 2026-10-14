# Contributing to OvenLovin

Thanks for helping. Please read the [Code of Conduct](./CODE_OF_CONDUCT.md) and
[Security Policy](./SECURITY.md) first.

Longer how-to: [docs contributing](https://tbarho.github.io/ovenlovin/docs/contributing)
and [`AGENTS.md`](./AGENTS.md) for LLM/agent conventions.

## Pitch

The family recipe box your AI can actually use, and it knows who can't eat what.

Allergen checks are **not medical advice**. Always read ingredient labels.

## Setup

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
```

Node ≥ 20, pnpm ≥ 9. Signed-in kitchen without production Clerk:

```bash
./scripts/e2e-kitchen-up.sh
E2E_AUTH_BYPASS=1 DATABASE_URL=postgresql://ovenlovin:ovenlovin@localhost:5432/ovenlovin \
  pnpm --filter @ovenlovin/web dev
```

Never set `E2E_AUTH_BYPASS` on a Vercel production deploy.

## Rules we will not merge around

1. Business logic lives in `@ovenlovin/core`. REST, MCP, and UI are thin adapters.
2. Zod-first schemas. Safety-critical rule checking is deterministic and per-person.
3. Never silently hide recipes or report “no issues” when a check is incomplete.
4. Fixtures, tests, and docs use generic names (“Parent A”, “Child B”). The e2e
   kitchen seed is the one exception, for visual UAT only.
5. Conventional Commits (`feat(web): …`, `fix(mcp): …`). CI must be green.

## Pull requests

Use the PR template. Include tests for allergen/rule changes. Small, focused PRs.

## Questions

- Spec: [GitHub issue #1](https://github.com/tbarho/ovenlovin/issues/1)
- Docs: https://tbarho.github.io/ovenlovin/
