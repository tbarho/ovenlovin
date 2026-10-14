# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- SECURITY, CONTRIBUTING, Code of Conduct, issue/PR templates
- Clerk-exempt `/robots.txt` and `/sitemap.xml` so they are not HTML 404'd

## [0.1.0] - 2026-10-14

First tagged kitchen. Agents can sign in with a household API key.

### Added

- Recipes, cookbooks, people, and per-person Can't eat / Doesn't like / Loves rules
- Who-can-eat findings on dishes (`block` / `warn` / `prefer-avoid`); incomplete checks stay incomplete
- Meal plan week view and shopping list
- REST `/api/v1` with `Authorization: ApiKey rkapi_…` or `Bearer rkapi_…` (problem+json 401/403)
- MCP Streamable HTTP at `/mcp`: household derived from the API key, stateless per-request transport, real tool schemas, JSON-RPC error envelopes
- MCP tools: `whoami`, create/delete recipe, delete meal plan, people / rules / loves
- `/docs`, `/docs/connect-your-agent`, `/llms.txt`, OpenAPI with the instance URL and API key auth
- Signed-in kitchen e2e harness (test-only `E2E_AUTH_BYPASS`, never on Vercel production)
- AI SDK 5 for `import_recipe`
- Public no-signup demo sandboxes (separate Vercel project; blocked on product production)

- Marketing landing for signed-out visitors; owner internals only after sign-in
- Web app manifest, `robots.txt`, and `sitemap.xml`
- `metadataBase` so Open Graph URLs are never localhost

### Security

- Clerk `auth.protect` no longer wraps `/api/v1` (that returned an HTML 404 to API keys)
- Production 404 for `/prototype` and `/dev/*`

[Unreleased]: https://github.com/tbarho/ovenlovin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tbarho/ovenlovin/releases/tag/v0.1.0
