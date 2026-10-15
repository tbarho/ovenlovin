---
layout: default
title: API Reference
---

# API Reference

> **REST API and OpenAPI specification for OvenLovin**

OvenLovin provides a REST API for managing recipes, meal plans, household members, and dietary rules. The API follows REST principles, uses JSON for request/response bodies, and provides an OpenAPI 3.1 specification for code generation and tooling.

## Base URL

```
https://your-app.vercel.app/api/v1
```

Replace `your-app.vercel.app` with your Vercel deployment URL.

## Authentication

All API requests require authentication using an API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-app.vercel.app/api/v1/recipes
```

### Getting an API Key

1. Log in to your OvenLovin instance
2. Go to Settings → API Keys
3. Click "Create API Key"
4. Select scopes:
   - `recipes:read` - Read recipes
   - `recipes:write` - Create/update/import recipes
   - `plans:read` - Read meal plans
   - `plans:write` - Create/update meal plans
   - `household:read` - Read household context
   - `household:admin` - Manage household members and rules
5. Copy the API key (shown only once)

### API Key Format

```
olvn_key_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

API keys start with `olvn_key_` followed by a random string.

## OpenAPI Specification

Download the OpenAPI 3.1 specification:

**JSON**:
```bash
curl https://your-app.vercel.app/api/v1/openapi.json > openapi.json
```

**YAML**:
```bash
curl https://your-app.vercel.app/api/v1/openapi.yaml > openapi.yaml
```

The OpenAPI spec can be used with:
- **Postman** - Import to generate API collection
- **Swagger UI** - Interactive API documentation
- **OpenAPI Generator** - Generate client libraries
- **ChatGPT Actions** - Configure Custom GPT to use OvenLovin

## Pagination

OvenLovin uses cursor-based pagination for list endpoints:

**First page**:
```bash
GET /api/v1/recipes?limit=10
```

**Response**:
```json
{
  "items": [...],
  "hasMore": true,
  "nextCursor": "abc123def456"
}
```

**Next page**:
```bash
GET /api/v1/recipes?limit=10&cursor=abc123def456
```

**Parameters**:
- `limit` (optional, default 20, max 100) - Number of items per page
- `cursor` (optional) - Cursor from previous response's `nextCursor`

## Error Handling

Errors follow [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457):

**Error response**:
```json
{
  "type": "https://ovenlovin.example/errors/not-found",
  "title": "Recipe not found",
  "status": 404,
  "detail": "Recipe with ID 'recipe-123' does not exist or you don't have permission to access it",
  "instance": "/api/v1/recipes/recipe-123"
}
```

**Common error types**:
- `400 Bad Request` - Invalid request (missing/invalid parameters)
- `401 Unauthorized` - Missing or invalid API key
- `403 Forbidden` - Insufficient permissions (check API key scopes)
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (duplicate name, version mismatch)
- `422 Unprocessable Entity` - Validation failed (invalid data)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Rate Limiting

**Limits** (per API key):
- 100 requests per minute
- 1,000 requests per hour
- 10,000 requests per day

**Response headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

**429 response** when limit exceeded:
```json
{
  "type": "https://ovenlovin.example/errors/rate-limit",
  "title": "Rate limit exceeded",
  "status": 429,
  "detail": "Too many requests. Try again after 2026-10-12T21:30:00Z",
  "retryAfter": "2026-10-12T21:30:00Z"
}
```

## Endpoints

### Recipes

#### List Recipes

```
GET /api/v1/recipes
```

**Query parameters**:
- `limit` (integer, optional) - Items per page (default 20, max 100)
- `cursor` (string, optional) - Pagination cursor
- `cuisine` (string, optional) - Filter by cuisine
- `tags` (string[], optional) - Filter by tags (comma-separated)
- `prepTimeMinutes_lte` (integer, optional) - Max prep time
- `cookTimeMinutes_lte` (integer, optional) - Max cook time
- `search` (string, optional) - Search in title, ingredients, description
- `forAttendees` (string, optional) - Person IDs (repeat or comma-separated). Recipes that hit a `block` rule for any attendee are omitted from `items` and listed in `hidden`.

**Response**:
```json
{
  "items": [
    {
      "id": "recipe-123",
      "title": "Spaghetti Carbonara",
      "description": "Classic Italian pasta with eggs, cheese, and pancetta",
      "cuisine": "Italian",
      "servings": 4,
      "prepTimeMinutes": 10,
      "cookTimeMinutes": 20,
      "tags": ["pasta", "dinner", "italian"],
      "createdAt": "2026-10-01T12:00:00Z",
      "updatedAt": "2026-10-01T12:00:00Z"
    }
  ],
  "hasMore": false,
  "nextCursor": null,
  "hiddenCount": 1,
  "hidden": [
    {
      "id": "recipe-pesto",
      "title": "Pesto pasta",
      "reasons": [
        {
          "personId": "person-1",
          "personName": "Child A",
          "ingredientName": "pine nuts",
          "message": "Child A cannot eat pine nuts (block rule: Tree Nut)"
        }
      ]
    }
  ]
}
```

`hiddenCount` / `hidden` are present when `forAttendees` is set. Warn / prefer-avoid findings stay on visible recipes; only blocks hide a recipe.

#### Get Recipe

```
GET /api/v1/recipes/{recipeId}
```

**Response**:
```json
{
  "id": "recipe-123",
  "title": "Spaghetti Carbonara",
  "description": "Classic Italian pasta with eggs, cheese, and pancetta",
  "cuisine": "Italian",
  "servings": 4,
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 20,
  "totalTimeMinutes": 30,
  "difficulty": "easy",
  "tags": ["pasta", "dinner", "italian"],
  "ingredients": [
    {
      "name": "spaghetti",
      "quantity": "1",
      "unit": "lb",
      "notes": "dry pasta"
    },
    {
      "name": "eggs",
      "quantity": "4",
      "unit": "large",
      "notes": "room temperature"
    },
    {
      "name": "parmesan cheese",
      "quantity": "1",
      "unit": "cup",
      "notes": "freshly grated"
    },
    {
      "name": "pancetta",
      "quantity": "6",
      "unit": "oz",
      "notes": "diced"
    }
  ],
  "instructions": [
    "Bring a large pot of salted water to boil",
    "Cook spaghetti according to package directions",
    "While pasta cooks, fry pancetta until crispy",
    "Beat eggs and mix with grated parmesan",
    "Drain pasta, reserving 1 cup pasta water",
    "Toss hot pasta with pancetta and egg mixture",
    "Add pasta water as needed for creamy sauce",
    "Serve immediately with extra parmesan"
  ],
  "nutrition": {
    "calories": 580,
    "protein": 28,
    "carbs": 65,
    "fat": 22,
    "fiber": 3,
    "sodium": 520
  },
  "source": {
    "type": "url",
    "url": "https://example.com/carbonara",
    "importedAt": "2026-10-01T12:00:00Z"
  },
  "createdBy": "user-123",
  "householdId": "household-456",
  "createdAt": "2026-10-01T12:00:00Z",
  "updatedAt": "2026-10-01T12:00:00Z"
}
```

#### Create Recipe

```
POST /api/v1/recipes
```

**Request body**:
```json
{
  "title": "Veggie Stir Fry",
  "description": "Quick and healthy vegetable stir fry",
  "cuisine": "Asian",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 10,
  "difficulty": "easy",
  "tags": ["vegetarian", "dinner", "quick"],
  "ingredients": [
    {
      "name": "broccoli",
      "quantity": "2",
      "unit": "cups",
      "notes": "cut into florets"
    },
    {
      "name": "bell peppers",
      "quantity": "2",
      "unit": "whole",
      "notes": "sliced"
    },
    {
      "name": "soy sauce",
      "quantity": "3",
      "unit": "tbsp"
    },
    {
      "name": "garlic",
      "quantity": "3",
      "unit": "cloves",
      "notes": "minced"
    }
  ],
  "instructions": [
    "Heat oil in large wok or skillet",
    "Add garlic and cook until fragrant",
    "Add vegetables and stir fry 5-7 minutes",
    "Add soy sauce and toss to coat",
    "Serve over rice"
  ]
}
```

**Response**: `201 Created` with created recipe object

#### Import Recipe

```
POST /api/v1/recipes/import
```

**Request body** (URL import):
```json
{
  "source": {
    "type": "url",
    "url": "https://example.com/chocolate-chip-cookies"
  }
}
```

**Request body** (text import):
```json
{
  "source": {
    "type": "text",
    "text": "Chocolate Chip Cookies\n\nIngredients:\n- 2 cups flour\n- 1 cup butter..."
  }
}
```

**Response**: `201 Created`
```json
{
  "id": "recipe-456",
  "title": "Chocolate Chip Cookies",
  "confidence": 0.95,
  "warnings": [
    "Could not extract nutrition information"
  ],
  "recipe": {
    "id": "recipe-456",
    "title": "Chocolate Chip Cookies",
    ...
  }
}
```

#### Import Recipe from Photo

```
POST /api/v1/recipes/import/photo
```

Extract a recipe from a recipe card, cookbook page, screenshot, or several pages of one recipe. Default is **preview only** so a human can review fields before save. The first photo is stored in Vercel Blob and becomes the recipe's single main image.

Needs AI Gateway (`AI_GATEWAY_API_KEY` locally; OIDC on Vercel). Vision model: `RK_MODEL_VISION` or `spacexai/grok-4.7`.

**JSON** (Blob URL or base64):

```json
{
  "imageUrl": "https://blob.vercel-storage.com/recipe-card.jpg",
  "isHandwritten": false,
  "save": false
}
```

```json
{
  "imageBase64": "<base64>",
  "mimeType": "image/jpeg",
  "save": true,
  "cookbookId": "11111111-1111-4111-8111-111111111111"
}
```

**Multipart** (file upload):

```bash
curl -X POST https://your-app.vercel.app/api/v1/recipes/import/photo \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "image=@recipe-card.jpg" \
  -F "image=@page-2.jpg"
```

**Response** (`200` preview, `201` when `save=true`):

```json
{
  "title": "Weeknight Tomato Pasta",
  "servings": 4,
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 20,
  "notes": "Salt the pasta water well.",
  "images": ["https://blob.vercel-storage.com/main.jpg"],
  "overallConfidence": 0.88,
  "needsReview": true,
  "uncertainFields": [],
  "allergenClassifications": [
    {
      "ingredientText": "parmesan",
      "allergenCode": "milk",
      "allergenName": "parmesan",
      "relation": "contains"
    }
  ]
}
```

Low-confidence or blurry photos return `uncertainFields` naming the values to check (`title`, `servings`, `times`, `ingredient: …`, `step N`). After preview, save the edited draft with `POST /api/v1/recipes` or call this endpoint with `save=true`.

#### Check Recipe

```
POST /api/v1/recipes/{recipeId}/check
```

**Request body**:
```json
{
  "attendees": ["person-1", "person-2", "person-3"]
}
```

**Response**:
```json
{
  "status": "complete",
  "findings": {
    "block": [
      {
        "personId": "person-1",
        "personName": "Parent A",
        "severity": "block",
        "ingredientName": "eggs",
        "ruleName": "Egg allergy",
        "message": "Parent A: recipe contains eggs (block rule: Egg allergy)"
      }
    ],
    "warn": [],
    "prefer_avoid": []
  },
  "summary": {
    "affectedPeople": ["person-1"],
    "safe": false
  }
}
```

#### Update Recipe

```
PATCH /api/v1/recipes/{recipeId}
```

Updates title, servings, prep/cook times, images, ingredients, steps, and cookbook membership. Replacing `ingredients` or `steps` soft-deletes the previous rows and inserts the new list.

#### Upload Recipe Image

```
POST /api/v1/uploads/images
```

Accepts `multipart/form-data` (`file`) or `{ "url": "https://..." }`. Copies the file into Vercel Blob and returns `{ "url": "https://....blob.vercel-storage.com/..." }`.

### Cookbooks

Recipes optionally belong to one or more cookbooks (many-to-many). A weeknight pasta can live in both "Weeknights" and "Kid favorites" without being duplicated. Recipes with no cookbook membership appear as uncategorized.

#### List Cookbooks

```
GET /api/v1/cookbooks
GET /api/v1/cookbooks?view=cards
```

`view=cards` includes `recipeCount` and up to four `previewImages` for the kitchen mosaic.

#### Create Cookbook

```
POST /api/v1/cookbooks
```

```json
{ "name": "Weeknight dinners", "description": "Fast after-practice meals" }
```

#### Get / Rename / Delete Cookbook

```
GET /api/v1/cookbooks/{cookbookId}
PATCH /api/v1/cookbooks/{cookbookId}
DELETE /api/v1/cookbooks/{cookbookId}
```

Deleting a cookbook removes memberships only. Recipes stay in the household.

#### Add or Remove a Recipe

```
POST /api/v1/cookbooks/{cookbookId}/recipes
{ "recipeId": "..." }

DELETE /api/v1/cookbooks/{cookbookId}/recipes?recipeId=...
```

List recipes in a cookbook with `GET /api/v1/recipes?cookbookId=...`. Unfiled recipes: `GET /api/v1/recipes?uncategorized=true`.

### Households

#### Get Household Context

```
GET /api/v1/households/{householdId}/context
```

**Response**:
```json
{
  "household": {
    "id": "household-123",
    "name": "Household 1",
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "people": [
    {
      "id": "person-1",
      "displayName": "Parent A",
      "role": "admin",
      "rules": [
        {
          "id": "rule-1",
          "kind": "allergen",
          "target": "peanut",
          "severity": "block",
          "notes": "Severe peanut allergy - EpiPen required"
        }
      ]
    },
    {
      "id": "person-2",
      "displayName": "Child B",
      "role": "member",
      "rules": [
        {
          "id": "rule-2",
          "kind": "dietary",
          "target": "vegetarian",
          "severity": "block"
        }
      ]
    }
  ]
}
```

#### Add Person Rule

```
POST /api/v1/households/{householdId}/people/{personId}/rules
```

**Request body**:
```json
{
  "kind": "allergen",
  "target": "dairy",
  "severity": "block",
  "notes": "Lactose intolerant"
}
```

**Response**: `201 Created` with created rule object

#### Reorder people

Household people have a persistent `sortOrder`. `GET /api/v1/people` returns that order (used by the people list, who-can-eat, and pickers). New people are appended.

```
POST /api/v1/people/reorder
```

```json
{ "personIds": ["person-ty", "person-bec", "person-ellie"] }
```

`personIds` must list every household person exactly once. Response: `{ "items": [/* people in the new order */] }`. `PATCH /api/v1/people/{id}` also accepts `sortOrder`.

#### Person Loves (preferences)

Loves never hide recipes. They boost ranking (meal planner / `search_recipes`) and show a small “{Name} loves this” tag.

```
GET    /api/v1/people/{personId}/preferences?type=love
POST   /api/v1/people/{personId}/preferences
DELETE /api/v1/people/{personId}/preferences/{prefId}
```

```json
{ "type": "love", "value": "salmon", "weight": 1 }
```

`value` can be a catalog code (`salmon`, `mexican`, `spicy`) or a custom term. Custom terms match ingredient lines case-insensitively, plural-tolerant.

### Meal Plans

#### Create Meal Plan

```
POST /api/v1/meal-plans
```

**Request body**:
```json
{
  "weekStart": "2026-10-13",
  "status": "draft",
  "entries": [
    {
      "date": "2026-10-13",
      "meal": "dinner",
      "recipeId": "recipe-123",
      "servings": 4,
      "attendees": ["person-1", "person-2"]
    }
  ]
}
```

**Response**: `201 Created` with the plan and `entries`. Create still takes the full week list.

#### Get Meal Plan

```
GET /api/v1/meal-plans/{planId}
```

Each entry includes `date`, `mealSlot`, `recipeId` and/or `freeformMeal`, `servings`, and `attendees`.

#### Patch Meal Plan (per-night merge)

```
PATCH /api/v1/meal-plans/{planId}
```

`entries` **merge by date + meal** by default. Send one night to set or swap it; other nights stay. `{ "clear": true }` removes that night. The response includes `previousEntries` (those nights as they were) so a client can revert.

```json
{ "entries": [{ "date": "2026-10-15", "meal": "dinner", "recipeId": "recipe-456", "servings": 4 }] }
```

```json
{ "entries": [{ "date": "2026-10-16", "meal": "dinner", "freeformMeal": "Leftovers", "servings": 3 }] }
```

```json
{ "entries": [{ "date": "2026-10-17", "meal": "dinner", "clear": true }] }
```

Full-week rewrite (the old behavior):

```json
{ "entriesMode": "replace", "entries": [{ "date": "2026-10-15", "meal": "dinner", "recipeId": "recipe-456" }] }
```

#### Check Meal Plan

```
POST /api/v1/meal-plans/{planId}/check
```

**Response**:
```json
{
  "status": "complete",
  "findings": {
    "block": [],
    "warn": [
      {
        "personId": "person-2",
        "personName": "Child B",
        "severity": "warn",
        "ingredientName": "sodium (650mg)",
        "mealDate": "2026-10-13",
        "mealSlot": "dinner",
        "recipeName": "Spaghetti Carbonara",
        "message": "Child B: recipe exceeds sodium limit (warn: 600mg max)"
      }
    ],
    "prefer_avoid": []
  },
  "summary": {
    "affectedPeople": ["person-2"],
    "entriesWithBlocks": 0,
    "entriesWithWarnings": 1,
    "entriesWithPreferAvoid": 0
  }
}
```

#### Generate Shopping List

```
GET /api/v1/meal-plans/{planId}/shopping-list
```

**Query parameters**:
- `format` (string, optional) - `json` (default), `csv`, `markdown`, or `text`
- `groupBy` (string, optional) - `aisle` (default), `recipe`, or `category`
- `includeStaples` (boolean, optional) - Include kitchen staples such as salt, pepper, and oil. Distinct from the **pantry** food-taxonomy category (flour, canned goods). Default `false`.
- `includePantryItems` (boolean, optional) - Deprecated alias for `includeStaples`.

**Response** (JSON):
```json
{
  "planId": "plan-123",
  "generatedAt": "2026-10-12T21:00:00Z",
  "sections": [
    {
      "name": "Produce",
      "items": [
        {
          "ingredient": "broccoli",
          "quantity": "4 cups",
          "recipes": ["recipe-456"],
          "warnings": []
        }
      ]
    },
    {
      "name": "Pantry",
      "items": [
        {
          "ingredient": "peanut butter",
          "quantity": "1 jar",
          "recipes": ["recipe-789"],
          "warnings": [
            {
              "personId": "person-1",
              "personName": "Parent A",
              "severity": "block",
              "message": "Block: Parent A - peanut allergy"
            }
          ]
        }
      ]
    }
  ]
}
```

**Response** (text format):
```
Shopping List - Week of Oct 13, 2026

Produce
  • 4 cups broccoli
  • 2 bell peppers
  • 1 head garlic

Pantry
  • ⚠️ 1 jar peanut butter [⚠️ Block: Parent A - peanut allergy]
  • 3 tbsp soy sauce

Dairy
  • 1 cup parmesan cheese
  • 4 eggs
```

## MCP Server

In addition to the REST API, OvenLovin provides a Model Context Protocol (MCP) server for AI agents.

**Endpoint**: `https://your-app.vercel.app/mcp`

**Transport**: HTTP with Streamable HTTP

**Tools**:
- `search_recipes` - Search recipes by text and filters
- `get_recipe` - Get full recipe details
- `import_recipe` - Import from URL or pasted text
- `import_recipe_from_image` - Import from a photo URL or base64
- `get_household_context` - Get household members and dietary rules
- `save_meal_plan` - Create or update a meal plan
- `check_meal_plan` - Run allergen and dietary rule checks
- `export_shopping_list` - Generate shopping list with warnings

See the [Bot Setup Guide](bot-setup.md) for MCP configuration instructions.

## Code Examples

### JavaScript/TypeScript

```typescript
const OVENLOVIN_API_KEY = 'olvn_key_abc123...';
const BASE_URL = 'https://your-app.vercel.app/api/v1';

// Search recipes
const searchRecipes = async (query: string) => {
  const response = await fetch(`${BASE_URL}/recipes?search=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${OVENLOVIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
};

// Get household context
const getHouseholdContext = async (householdId: string) => {
  const response = await fetch(`${BASE_URL}/households/${householdId}/context`, {
    headers: {
      'Authorization': `Bearer ${OVENLOVIN_API_KEY}`,
    },
  });
  return await response.json();
};

// Check meal plan
const checkMealPlan = async (planId: string) => {
  const response = await fetch(`${BASE_URL}/meal-plans/${planId}/check`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OVENLOVIN_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
};
```

### Python

```python
import requests

OVENLOVIN_API_KEY = 'olvn_key_abc123...'
BASE_URL = 'https://your-app.vercel.app/api/v1'

# Search recipes
def search_recipes(query: str):
    response = requests.get(
        f'{BASE_URL}/recipes',
        params={'search': query},
        headers={'Authorization': f'Bearer {OVENLOVIN_API_KEY}'}
    )
    return response.json()

# Get household context
def get_household_context(household_id: str):
    response = requests.get(
        f'{BASE_URL}/households/{household_id}/context',
        headers={'Authorization': f'Bearer {OVENLOVIN_API_KEY}'}
    )
    return response.json()

# Check meal plan
def check_meal_plan(plan_id: str):
    response = requests.post(
        f'{BASE_URL}/meal-plans/{plan_id}/check',
        headers={'Authorization': f'Bearer {OVENLOVIN_API_KEY}'}
    )
    return response.json()
```

### cURL

```bash
# Search recipes
curl -H "Authorization: Bearer $OVENLOVIN_API_KEY" \
  "https://your-app.vercel.app/api/v1/recipes?search=pasta"

# Get household context
curl -H "Authorization: Bearer $OVENLOVIN_API_KEY" \
  "https://your-app.vercel.app/api/v1/households/household-123/context"

# Check meal plan
curl -X POST \
  -H "Authorization: Bearer $OVENLOVIN_API_KEY" \
  "https://your-app.vercel.app/api/v1/meal-plans/plan-123/check"
```

## Webhook Events

OvenLovin can send webhook events for key actions (coming soon):

**Event types**:
- `recipe.created` - New recipe created or imported
- `recipe.updated` - Recipe edited
- `meal_plan.created` - Meal plan created
- `meal_plan.checked` - Meal plan allergen check completed
- `rule.created` - Dietary rule added
- `rule.updated` - Dietary rule modified

**Webhook payload**:
```json
{
  "id": "evt_123",
  "type": "recipe.created",
  "timestamp": "2026-10-12T21:00:00Z",
  "data": {
    "recipeId": "recipe-123",
    "householdId": "household-456",
    "title": "Chocolate Chip Cookies"
  }
}
```

## Resources

- **[Bot Setup Guide](bot-setup.md)** - Configure AI bots to use the API
- **[Allergy & Dietary Rules](rules.md)** - Understand rule checking behavior
- **[GitHub Repository](https://github.com/tbarho/ovenlovin)** - Source code and examples

---

Built with ❤️ for AI-powered family meal planning
