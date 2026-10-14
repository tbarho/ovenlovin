# Security Policy

## Allergen and dietary checks

OvenLovin checks recipes against **per-person rules** the household admin sets. This is safety-relevant software.

- Findings always name the person, the rule, the ingredient, and the reason.
- Incomplete checks return `status: incomplete` — never “no issues.”
- Rules are not hard-coded allergen policy. The family admin configures them.
- OvenLovin is **not medical advice**. Always read ingredient labels before serving.

If you find a way a `block` rule can miss a matching ingredient, or a check can report clean when it did not finish, treat that as a security/safety issue.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

**Do not** open a public GitHub issue for vulnerabilities or allergen-check misses that could harm someone.

1. Use [GitHub private vulnerability reporting](https://github.com/tbarho/ovenlovin/security/advisories/new) on this repository.
2. Include: what you expected, what happened, steps to reproduce, and whether a person with a `block` rule could be served a matching ingredient.
3. We will acknowledge the report and work a fix before any public disclosure.

## Auth and secrets

- Household API keys (`rkapi_…`) are bearer credentials. They authenticate REST `/api/v1` and MCP `/mcp`. Treat a leaked key as a household compromise: revoke it in Settings.
- Never commit `.env`, Clerk secrets, database URLs, or live API keys.
- `E2E_AUTH_BYPASS` is a **test-only** auth shim. It is never active in a Vercel production build. **Do not** set `E2E_AUTH_BYPASS` on Vercel production environment variables. A production build fails if the flag is requested.
- `/prototype` and `/dev/*` are UX fixtures. They are 404 on the production host.

## Production Clerk

Production must use a dedicated Clerk instance (not development keys). Organizations map to households. Rotate keys if a development instance was ever pointed at production data.
