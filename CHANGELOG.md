# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each `## YYYY-MM-DD - Title` block is one ship day (UTC merge date on `main`). `apps/web` renders this file at `/changelog`, so write it for the people and agents who cook with OvenLovin.

## [Unreleased]

Nothing yet. Everything below is on `main`.

## 2026-10-27 - Day-one polish

Small things you notice on a phone in the first minute.

### Links that look like links

Inline links in the docs are underlined, so you can tell a link from bold text without hovering.

### Clearer key copy and a calmer phone layout

Connect your agent now says it plainly: send your key as `Authorization: ApiKey YOUR_KEY`, and `Bearer` works in its place. On a 390px phone the week cook-for picker shows its full label, the sign-in card gives the form more room, and the kitchen logo is a full 44px tap target.

Shipped in #352 and #353.

## 2026-10-22 - Ready for real sign-ins

OvenLovin is ready to move off Clerk development mode, and the public pages passed a full design review.

### In-app sign-in by default

Sign-in and sign-up live inside OvenLovin, keep you on the page you came from, and center cleanly on every screen size. The cutover steps for Clerk production are in the deploy docs.

### Cook-for follows your household

Add or remove a person and the week's cook-for count follows, so the plan and the shopping list stay in step. Deleted recipes no longer show up in meal plan reads over REST or MCP.

### A shopping list you can shop from

Mass and volume merge when we know the ingredient's density, flour lines collapse into one, and words like "unsalted" and "seeds" stay on the list where they belong.

### Taps and docs

Tap targets are at least 44px, without getting in the way of the servings slider. The REST reference, OpenAPI spec, and `llms.txt` match the live API, and the GitHub Pages docs have no dead links.

## 2026-10-21 - Every import failure has a name

When a recipe will not import, OvenLovin tells you why and what to try next.

### Named failures with a way forward

Blocked sites, checkpoint pages, 404s, About pages, and pages that are simply not recipes each get their own reason, in the app and as failure codes on REST and MCP. Every failure offers Paste or Photo as the next step. Photo, URL, and paste imports show their stages and can be canceled.

### Better reading of real recipes

Ingredient lines like `1 c.`, `1-1/2`, `½`, grams, and "makes 2 dozen" parse correctly, and Wikibooks ingredient tables come through. We stopped guessing 4 servings when a recipe does not say. Imports are measured against live recipe sites with an eval suite and now default to DeepSeek Flash.

### API key scopes, enforced

API key scopes are checked on every REST and MCP call. Foreign or malformed ids return 404, invalid bodies return 400 instead of 500, and import refuses non-public URLs before any fetch. Sign-in and demo redirects only go where they should.

### Cook-for, once per week

The week's cook-for number is stored once, so the plan and the shopping list always agree. Open a recipe from the plan and it is already scaled to that week.

### Food rules that read like people talk

A red can't-eat chip leads the recipe page. Spicy rules catch heat ingredients like chiles. Food rules are type-to-search, and the warning sheet is skipped when nobody in the household has rules.

## 2026-10-20 - Preview before you save

### See it, then keep it

URL and paste imports show a preview before anything is saved, and saving a preview does not call the AI again. Agents get the same flow over MCP, with idempotent saves and an `allowDuplicate` switch. Duplicates are caught before we even fetch the page.

### One servings number

Each recipe has one effective servings number, with a slider sized to the recipe, and scaled amounts come out in quantities you can measure in a real kitchen. Plan, shopping list, REST, and MCP all agree on it.

### Imports that fail softly

When the AI that reads recipes is down, you get a clear 503 and an automatic fallback instead of a broken save. Image fetches are hardened, bad images are dropped instead of stored, and writes carry `Retry-After` when you hit a limit.

## 2026-10-19 - Kitchen roles that mean something

### Who can change what

Viewers can look but not write. Only admins can change people's food rules and loves. API keys stop working when the person who made them leaves the kitchen, on REST and MCP alike, and MCP sessions take their role from kitchen membership.

### Family-sized by default

New recipes default to your family's servings, and scaled quantities use the fractions cooks actually use.

## 2026-10-18 - A kitchen menu on your phone

The phone tab bar is now a single kitchen menu sheet, and `/recipes` opens on your recipe list.

## 2026-10-17 - Invite your household

### Kitchen invites

Invite people to your kitchen from Settings, over REST, or from your agent over MCP. They accept from a link and join as members, not owners. Household API keys can create invites but cannot accept them.

### Save from any site

When a site blocks URL import, a bookmarklet or your device can capture the page and send it to OvenLovin.

## 2026-10-16 - Imports that explain themselves

### Honest photo reads

When a photo is hard to read, OvenLovin marks the uncertain fields instead of guessing quietly. Photo imports keep going if you switch tabs, and big photos are compressed before saving.

### A simpler URL import

URL import reads the page's recipe data first and only asks a small, cheap model when it has to. Fetching is down to three named layers: direct, Google Translate, and Jina.

### Plans that check themselves

Dinners are checked against your household as soon as they are saved, and the recheck banner only appears when something actually needs a look.

## 2026-10-15 - Edit the week, shop the aisles

The meal plan became something you can actually run your week on.

### Pick, swap, or clear a night

Change any dinner from the plan, mark a night as no-cook, and undo any of it. Mark the week as final when you are happy, with a confirmation if a dinner still carries a risk. Agents can edit nights and round-trip leftovers over MCP.

### One calm allergy notice

Warnings are written in plain language, one per person per meal, gathered into a single notice on the plan. A plan with someone left off a dinner is never called complete.

### A list grouped by aisle

The shopping list groups by aisle, shows fractions and shoppable units, and remembers what you checked off. Add extras, remove items, or clear everything checked.

### Recipes and cookbooks

Add existing recipes to a cookbook from its page, delete a recipe with confirmation and undo, and search your recipes. URL import gets past more Cloudflare-protected sites.

## 2026-10-14 [0.1.0] - OvenLovin 0.1.0

The first tagged kitchen. A family recipe box your agent can actually use, that knows who can't eat what.

### People and their food rules

Every person in the household gets three plain lists: Can't eat, Doesn't like, and Loves. Drag people into the order you want. Recipes show who can eat them, with `block`, `warn`, and `prefer-avoid` findings, and a check with missing information stays incomplete instead of pretending to pass.

### Meal plan and shopping list

Plan the week, see when a dinner runs past that night's time budget, and get a shopping list that merges, scales, and groups what you need.

### Import from a photo

Snap a recipe card, handwritten or printed, and review what OvenLovin read before saving. Notes, source, and allergen hits come along. Recipes now have a notes field everywhere.

### Built for agents

REST at `/api/v1` accepts `Authorization: ApiKey rkapi_...` or `Bearer rkapi_...`, with problem+json errors and a complete OpenAPI spec. MCP at `/mcp` takes its household from the API key, with real tool schemas and new tools: `whoami`, create and delete recipe, delete plan, people, rules, and loves. `/docs`, `/docs/connect-your-agent`, and `/llms.txt` live on every instance.

### Try it without signing up

Public demo sandboxes give anyone a kitchen and a 24h key. Signed-out visitors see a marketing landing, with share cards that show the pitch and the kitchen. A desktop kitchen shell joins the phone layout.

### Security

API keys work on REST instead of hitting a sign-in page. `/prototype` and `/dev/*` return 404 in production. SECURITY, CONTRIBUTING, and a code of conduct are in the repo.

## 2026-10-13 - The kitchen gets a face

### Brand

OvenLovin got its oven mark and its Fascinate Inline wordmark, and the docs moved to a white Geist theme.

### A real kitchen

Your first sign-in creates a household and a photo-first recipes kitchen with cookbooks, images, servings scaling, and cook times. Create named API keys for your bots and revoke them any time.

### People and who-can-eat

A simplified People and Rules screen, built from a clickable prototype, runs on real household data. Every recipe shows who can eat it.

### Landing and deploy

The landing page shows your instance name, celebrates a fresh deploy, connects your agent, and offers a copyable prompt to migrate from ReciMe. Deploy to Vercel provisions Neon, Blob, and Clerk and migrates the database for you.

## 2026-10-12 - A recipe box agents can read

Day one: the foundation everything else stands on.

### Recipes in, three ways

Import from a URL using the page's recipe data, from pasted text, or from a photo, handwriting included.

### Deterministic allergen checks

An ingredient-to-allergen matcher and a rule checker that give the same answer every time, tested with adversarial and property-based cases. Not medical advice. Always read the label.

### REST, MCP, and a CLI

A REST API with OpenAPI, an MCP server over Streamable HTTP with recipe search and read tools, and a CLI for import and checks. Clerk sign-in, MCP OAuth, and API keys from the start.

### Deploy your own

One-click Deploy to Vercel with Neon, and a documentation site on GitHub Pages covering self-hosting, importers, the CLI, and the full reference.

[Unreleased]: https://github.com/tbarho/ovenlovin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tbarho/ovenlovin/releases/tag/v0.1.0
