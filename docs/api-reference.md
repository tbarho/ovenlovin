---
layout: default
title: API Reference
---

# API Reference

REST API for OvenLovin. JSON request and response bodies. OpenAPI 3.1 at `GET /api/v1/openapi.json`. This page matches the route handlers under `apps/web/src/app/api/v1`.

## Base URL

```
https://your-app.vercel.app/api/v1
```

Replace `your-app.vercel.app` with your Vercel deployment URL.

## Authentication

Most routes need `Authorization`. Send an API key (`rkapi_...`) as `Bearer` or `ApiKey`, or a Clerk JWT as `Bearer`. An API key is bound to one kitchen. A mismatched `X-Kitchen-Id` is `403`. Clerk users must already have a kitchen (open the app once). Optional `X-Kitchen-Id` selects a kitchen you belong to.

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-app.vercel.app/api/v1/recipes
```

No auth: `GET /health`, `GET /openapi.json`, `GET /invites/{token}`.

### API keys

```
GET    /api/v1/api-keys
POST   /api/v1/api-keys
DELETE /api/v1/api-keys/{id}
```

`POST` requires a signed-in admin or owner (a bot key cannot mint another key). Body: `{ "name": "Agent key", "scopes": ["recipes:read", "recipes:write", "plans:read", "plans:write", "people:read", "people:write", "lists:export"] }`. `name` defaults to `Agent key`. `scopes` are stored and returned; routes authorize by kitchen membership role (viewer / member / admin / owner), not by those scope strings. The plaintext key is in the `201` body once.

## OpenAPI Specification

```bash
curl https://your-app.vercel.app/api/v1/openapi.json > openapi.json
```

There is no `openapi.yaml` route. Import the JSON into Postman, Swagger UI, or OpenAPI Generator.

## Pagination

List endpoints that use `paginatedResponse` return:

```json
{
  "items": [],
  "hasMore": true,
  "nextCursor": "abc123def456"
}
```

- `limit` - optional, default `20`
- `cursor` - optional, previous `nextCursor`

`GET /people/{id}/rules` and `GET /people/{id}/preferences` return the array itself, not `{ items }`.

## Error Handling

Errors follow [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457):

```json
{
  "type": "https://your-app.vercel.app/problems/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/v1/recipes",
  "errors": [
    { "path": "title", "message": "Required", "code": "invalid_type" }
  ]
}
```

Statuses the handlers actually return:

- `400` - Bad request, Zod validation (`problems/validation-error`), classified import failures, invalid image URL
- `401` - Missing or invalid auth
- `403` - Role not allowed, API key kitchen mismatch, demo write/upload cap
- `404` - Missing resource, unknown path, invalid UUID path id
- `409` - Conflict (duplicate import URL or photo, in-flight import, household conflict)
- `410` - Expired invite
- `500` - Unhandled server error
- `503` - AI recipe reading is busy (`import_ai_unavailable`). `Retry-After: 60`

Validation is **400**, not 422. There is no 422 handler.

## Rate limiting

Product REST does not send `X-RateLimit-*` headers and does not apply a request-per-minute cap. The public demo can `403` writes after its sandbox cap and may set `Retry-After`. Import `503` sets `Retry-After: 60`.

## Idempotency-Key

Optional request header. Any string. The persist path trims it and keeps the first 512 characters. It is **not** required to be a UUID.

Used when saving a recipe:

- `POST /recipes`
- `POST /recipes/import` with `save: true`
- `POST /recipes/import/photo` with `save: true`

A completed key returns the first saved recipe (`200`). It does not return a "key conflict" status. `409` on import means a duplicate URL, exact-SHA photo, or an in-flight lock - not a key mismatch.

`POST /people`, `POST /people/{id}/rules`, and `POST /meal-plans` read the header today and do not pass it to the service.

## Health

```
GET /api/v1/health
```

No auth. `200`:

```json
{ "status": "ok", "version": "1.0.0", "timestamp": "2026-10-21T21:00:00.000Z" }
```

## Recipes

### List Recipes

```
GET /api/v1/recipes
```

Query: `limit`, `cursor`, `status`, `search`, `cookbookId`, `uncategorized=true`, `forAttendees` (repeat or comma-separated person IDs).

`forAttendees` omits recipes that hit a `block` rule from `items` and lists them in `hidden` with `hiddenCount`. Warn / prefer_avoid stay on visible recipes.

There are no `cuisine`, `tags`, or `prepTimeMinutes_lte` filters on this route.

### Get Recipe

```
GET /api/v1/recipes/{recipeId}
```

`200` recipe details. Ingredients use `rawText` (plus parsed fields when present). Steps use `text`. Optional `?servings=` scales the kitchen display; `displayServings` is the cook-for count and `servings` stays the stored card yield.

### Create Recipe

```
POST /api/v1/recipes
```

```json
{
  "title": "Veggie Stir Fry",
  "description": "Quick vegetable stir fry",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 10,
  "ingredients": [
    { "rawText": "2 cups broccoli, cut into florets" },
    { "rawText": "2 bell peppers, sliced" },
    { "rawText": "3 tbsp soy sauce" }
  ],
  "steps": [
    { "text": "Heat oil in a large wok or skillet." },
    { "text": "Add vegetables and stir fry 5-7 minutes." },
    { "text": "Add soy sauce and toss to coat." }
  ]
}
```

`201` on create. Same `Idempotency-Key` returns `200` with the first recipe. Optional `cookbookId` adds membership after create.

### Import Recipe (URL or paste)

```
POST /api/v1/recipes/import
```

Preview unless `save` is `true`. Kitchen UI and MCP send `save: true`. Send `Idempotency-Key` when persisting.

```json
{ "source": "url", "content": "https://example.com/chocolate-chip-cookies", "save": true }
```

```json
{ "source": "paste", "content": "Chocolate Chip Cookies\n\nIngredients:\n- 2 cups flour\n- 1 cup butter", "save": true }
```

`200` preview (`saved: false`, `preview: true`). `201` when saved. `200` on idempotent replay. Duplicate URL: `409` with `recipeId`, `title`, and `recipeUrl`. Demo responses may include `remainingImports`.

| `code` | HTTP | When |
| --- | --- | --- |
| `not_a_public_url` | 400 | URL is not a public http(s) address on port 80 or 443 |
| `import_blocked` | 400 | Site blocked the importer |
| `import_page_gone` | 400 | Page is gone |
| `import_not_a_recipe` | 400 | No recipe found |
| `import_unsupported_site` | 400 | Site is not supported |
| `import_ai_unavailable` | 503 | Gateway / model down, overloaded, or rate-limited. `Retry-After: 60` |

### Import Recipe from Photo

```
POST /api/v1/recipes/import/photo
```

Preview unless `save` is `true`. JSON (`imageUrl` or `imageBase64` + `mimeType`) or multipart `image` files. Exact SHA match: `409` with `recipeId`. Near-duplicate PNG: `possibleDuplicate` on preview, and `409` when `save: true` without `allowDuplicate: true`. Same import failure codes as URL/paste. Needs AI Gateway.

```bash
curl -X POST https://your-app.vercel.app/api/v1/recipes/import/photo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "image=@recipe-card.jpg"
```

### Update / Delete Recipe

```
PATCH  /api/v1/recipes/{recipeId}
DELETE /api/v1/recipes/{recipeId}
```

PATCH updates title, servings, times, images, ingredients, steps, and `cookbookIds`. Replacing `ingredients` or `steps` soft-deletes the previous rows. DELETE is `204`.

There is no `POST /recipes/{id}/check`. Check a plan instead.

## Uploads

```
POST /api/v1/uploads/images
```

`multipart/form-data` field `file` (JPEG, PNG, WebP, GIF, or AVIF, max 8MB) or JSON `{ "url": "https://..." }`. `201` `{ "url": "https://....blob.vercel-storage.com/..." }`. Demo returns `403`. Missing Blob config on multipart is `400`.

## Cookbooks

```
GET    /api/v1/cookbooks
GET    /api/v1/cookbooks?view=cards
POST   /api/v1/cookbooks
GET    /api/v1/cookbooks/{cookbookId}
PATCH  /api/v1/cookbooks/{cookbookId}
DELETE /api/v1/cookbooks/{cookbookId}
POST   /api/v1/cookbooks/{cookbookId}/recipes
DELETE /api/v1/cookbooks/{cookbookId}/recipes?recipeId=...
```

`view=cards` adds `recipeCount` and up to four `previewImages`. POST body: `{ "name": "Weeknight dinners", "description": "Fast after-practice meals" }`. Add a recipe: `{ "recipeId": "..." }`. Deleting a cookbook removes memberships only. List recipes in a cookbook: `GET /recipes?cookbookId=...`. Unfiled: `GET /recipes?uncategorized=true`.

## People

```
GET    /api/v1/people
POST   /api/v1/people
GET    /api/v1/people/{id}
PATCH  /api/v1/people/{id}
DELETE /api/v1/people/{id}
POST   /api/v1/people/reorder
```

POST body: `{ "displayName": "Parent A" }`. PATCH/DELETE require admin or owner. Reorder: `{ "personIds": ["...", "..."] }` must list every household person exactly once. Response: `{ "items": [/* people in the new order */] }`.

### Person rules

```
GET    /api/v1/people/{id}/rules
POST   /api/v1/people/{id}/rules
GET    /api/v1/people/{id}/rules/{ruleId}
PATCH  /api/v1/people/{id}/rules/{ruleId}
DELETE /api/v1/people/{id}/rules/{ruleId}
```

GET returns the rule array. POST/PATCH/DELETE require admin or owner.

```json
{
  "kind": "allergen",
  "target": "peanut",
  "severity": "block",
  "note": "EpiPen in the kitchen drawer"
}
```

`kind` is optional on create (`allergen`, `ingredient`, `ingredient_category`, `diet`, `tag`, `custom`). Field name is `note`, not `notes`. Unknown targets need `confirmUnknown: true` or the handler returns `400`. Duplicate create returns `200` with the existing rule; a new rule is `201`.

### Preferences (loves)

```
GET    /api/v1/people/{id}/preferences?type=love
POST   /api/v1/people/{id}/preferences
GET    /api/v1/people/{id}/preferences/{prefId}
DELETE /api/v1/people/{id}/preferences/{prefId}
```

```json
{ "type": "love", "value": "salmon", "weight": 1 }
```

Loves never hide recipes. POST/DELETE require admin or owner.

## Household

```
GET   /api/v1/households
PATCH /api/v1/households
GET   /api/v1/households/mine
POST  /api/v1/households/select
GET   /api/v1/households/settings
PATCH /api/v1/households/settings
GET   /api/v1/households/schedule
PUT   /api/v1/households/schedule
GET   /api/v1/households/members
PATCH /api/v1/households/members/{userId}
DELETE /api/v1/households/members/{userId}
POST  /api/v1/households/leave
GET   /api/v1/households/invites
POST  /api/v1/households/invites
DELETE /api/v1/households/invites/{id}
GET   /api/v1/invites/{token}
POST  /api/v1/invites/{token}/accept
```

There is no `GET /households/{householdId}/context`. Use `GET /households` plus `GET /people` and `GET /people/{id}/rules`.

Settings body: `{ "mode": "family" | "fixed" | "recipe", "servings": 8 }`. `fixed` requires `servings` (1-99). Response also includes `familySize` and `defaultCookFor`.

Schedule GET returns `{ "weeklyTemplate": [...], "overrides": [...] }`. PUT replaces the week: `{ "week": [/* nightly objects */] }`.

`POST /households/select` and invite accept require a signed-in user, not an API key. Expired invite: `410`.

## Meal Plans

```
GET    /api/v1/meal-plans
POST   /api/v1/meal-plans
GET    /api/v1/meal-plans/{planId}
PATCH  /api/v1/meal-plans/{planId}
DELETE /api/v1/meal-plans/{planId}
GET    /api/v1/meal-plans/{planId}/check
POST   /api/v1/meal-plans/{planId}/check
POST   /api/v1/meal-plans/{planId}/undo
GET    /api/v1/meal-plans/{planId}/history
GET    /api/v1/meal-plans/{planId}/shopping-list
GET    /api/v1/meal-plans/{planId}/shopping-list/state
PATCH  /api/v1/meal-plans/{planId}/shopping-list/state
```

List query: `limit`, `cursor`, `status`, `weekStart`, `weekEnd`.

Create:

```json
{
  "weekStart": "2026-10-13",
  "status": "draft",
  "entries": [
    {
      "date": "2026-10-13",
      "meal": "dinner",
      "recipeId": "11111111-1111-4111-8111-111111111111",
      "servings": 4,
      "attendees": ["22222222-2222-4222-8222-222222222222"]
    }
  ]
}
```

`201` with the plan and `entries`.

PATCH `entries` merge by date + meal. `{ "clear": true }` removes that night. Response includes `previousEntries`. Full-week rewrite: `{ "entriesMode": "replace", "entries": [...] }`.

### Check

GET runs the check. POST runs it and persists the report (write role). No request body. Attendees come from the plan entries.

### Undo / history

Each merge or replace PATCH records a snapshot. `POST .../undo` restores the latest snapshot (`404` if none). History is `{ "items": [...] }`, newest first.

### Shopping list

```
GET /api/v1/meal-plans/{planId}/shopping-list
```

Query: `format` = `json` (default), `csv`, `markdown`, or `text`; `groupBy` = `aisle` (default), `recipe`, or `category`; `includeStaples` (default `false`); deprecated alias `includePantryItems`; `timeZone` (IANA). JSON is a `ShoppingListData` object (`mealPlanId`, `weekStart`, `sections`, `ingredients`, `warnings`, `generatedAt`). Section items use `name`, `key`, `displayQuantity`, `recipes[]`, `isStaple`. The response is a file download (`Content-Disposition`).

Trip checkboxes:

```json
{
  "checkedKeys": ["broccoli"],
  "extras": [{ "key": "milk", "name": "milk" }]
}
```

Unknown keys on PATCH are `400`.

## MCP Server

**Endpoint**: `https://your-app.vercel.app/mcp`

**Transport**: HTTP with Streamable HTTP

Registered tools: `whoami`, `search_recipes`, `get_recipe`, `create_recipe`, `import_recipe`, `import_recipe_from_image`, `delete_recipe`, `get_household_context`, `manage_household_schedule`, `manage_household_settings`, `manage_kitchen_invites`, `manage_kitchen_members`, `get_person_rules`, `manage_people`, `manage_person_rules`, `manage_person_loves`, `check_meal_plan`, `export_shopping_list`, `save_meal_plan`, `get_meal_plan`, `edit_meal_plan`, `delete_meal_plan`, `list_cookbooks`, `get_cookbook`, `manage_cookbook`, `reorder_people`.

Classified import failures are JSON-RPC `-32602` (`invalidParams`). `import_ai_unavailable` is `-32603` (`internal`).

See [MCP tools](mcp-tools.md) and the [Bot Setup Guide](bot-setup.md).

## Code Examples

### TypeScript

```typescript
const OVENLOVIN_API_KEY = "rkapi_...";
const BASE_URL = "https://your-app.vercel.app/api/v1";

const searchRecipes = async (query: string) => {
  const response = await fetch(`${BASE_URL}/recipes?search=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${OVENLOVIN_API_KEY}` },
  });
  return await response.json();
};

const getHousehold = async () => {
  const response = await fetch(`${BASE_URL}/households`, {
    headers: { Authorization: `Bearer ${OVENLOVIN_API_KEY}` },
  });
  return await response.json();
};

const checkMealPlan = async (planId: string) => {
  const response = await fetch(`${BASE_URL}/meal-plans/${planId}/check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${OVENLOVIN_API_KEY}` },
  });
  return await response.json();
};
```

### Python

```python
import requests

OVENLOVIN_API_KEY = "rkapi_..."
BASE_URL = "https://your-app.vercel.app/api/v1"
headers = {"Authorization": f"Bearer {OVENLOVIN_API_KEY}"}

def search_recipes(query: str):
    return requests.get(f"{BASE_URL}/recipes", params={"search": query}, headers=headers).json()

def get_household():
    return requests.get(f"{BASE_URL}/households", headers=headers).json()

def check_meal_plan(plan_id: str):
    return requests.post(f"{BASE_URL}/meal-plans/{plan_id}/check", headers=headers).json()
```

### cURL

```bash
curl -H "Authorization: Bearer $OVENLOVIN_API_KEY" \
  "https://your-app.vercel.app/api/v1/recipes?search=pasta"

curl -H "Authorization: Bearer $OVENLOVIN_API_KEY" \
  "https://your-app.vercel.app/api/v1/households"

curl -X POST \
  -H "Authorization: Bearer $OVENLOVIN_API_KEY" \
  "https://your-app.vercel.app/api/v1/meal-plans/11111111-1111-4111-8111-111111111111/check"
```

## Resources

- **[Bot Setup Guide](bot-setup.md)** - Configure AI bots to use the API
- **[Allergy & Dietary Rules](rules.md)** - Understand rule checking behavior
- **[GitHub Repository](https://github.com/tbarho/ovenlovin)** - Source code and examples
