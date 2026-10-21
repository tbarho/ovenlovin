# Bot Setup Guide

> **How to connect Grok Bot, ChatGPT, and Claude to OvenLovin**

This guide covers connecting AI agents to OvenLovin's MCP server and REST API for recipe management, meal planning, and shopping list generation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [MCP Server Setup](#mcp-server-setup)
  - [Grok Bot (xAI)](#grok-bot-xai)
  - [Claude Desktop / Claude Code](#claude-desktop--claude-code)
  - [ChatGPT Custom GPTs](#chatgpt-custom-gpts)
- [REST API](#rest-api)
- [OpenAPI Integration](#openapi-integration)
- [Authentication](#authentication)
- [Available Tools & Resources](#available-tools--resources)
- [Example Workflows](#example-workflows)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- OvenLovin deployed to Vercel (or running locally)
- API key generated in the OvenLovin dashboard
- For MCP: Node.js ≥20

## MCP Server Setup

OvenLovin provides a Model Context Protocol (MCP) server that AI agents can connect to for structured access to recipes, meal plans, and household data.

### Environment Setup

First, set up your environment variables:

```bash
# .env.local (for local development)
DATABASE_URL=postgresql://...
# Optional off Vercel. On Vercel, AI Gateway uses OIDC (VERCEL_OIDC_TOKEN).
AI_GATEWAY_API_KEY=your-vercel-ai-gateway-key

# For production deployment
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-key
CLERK_SECRET_KEY=your-clerk-secret
```

### Local Development

Start the MCP server in development mode:

```bash
# From repository root
pnpm dev

# Or run only the MCP package
pnpm --filter @ovenlovin/mcp dev
```

The MCP server will be available at:
- **HTTP transport**: `http://localhost:3000/mcp` (via Next.js web server). `@ovenlovin/mcp` is a private workspace package, not an npm CLI.

### Production Deployment

Deploy to Vercel:

```bash
vercel deploy
```

Your MCP HTTP endpoint will be available at:
```
https://your-app.vercel.app/mcp
```

## Grok Bot (xAI)

Grok Bot connects to OvenLovin via the MCP HTTP transport using Streamable HTTP.

### Configuration

In your Grok Bot settings, add the MCP server:

```json
{
  "mcpServers": {
    "ovenlovin": {
      "transport": "http",
      "url": "https://your-app.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OVENLOVIN_API_KEY"
      }
    }
  }
}
```

Replace:
- `your-app.vercel.app` with your Vercel deployment URL
- `YOUR_OVENLOVIN_API_KEY` with an API key from your OvenLovin dashboard

### Testing the Connection

Ask Grok:
```
Search for recipes containing chicken
```

Grok will use the `search_recipes` MCP tool and return results from your OvenLovin instance.

## Claude Desktop / Claude Code

Claude Desktop and Claude Code connect over HTTP. `@ovenlovin/mcp` is not published to npm.

### HTTP Transport

```json
{
  "mcpServers": {
    "ovenlovin": {
      "transport": "http",
      "url": "https://your-app.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OVENLOVIN_API_KEY"
      }
    }
  }
}
```

### Testing

Restart Claude Desktop and ask:
```
Get the household context from OvenLovin
```

Claude will call the `get_household_context` tool and show your household members and their dietary rules.

## ChatGPT Custom GPTs

ChatGPT Custom GPTs can connect to OvenLovin via the REST API using Actions (OpenAPI).

### Create a Custom GPT

1. Go to [ChatGPT Custom GPT Builder](https://chatgpt.com/gpts/editor)
2. Create a new GPT with name "OvenLovin Assistant"
3. Add this description:
   ```
   Helps with recipe management, meal planning, and grocery lists using the OvenLovin API.
   Can search recipes, check allergen rules, create meal plans, and generate shopping lists.
   ```

### Configure Actions

In the "Actions" section:

1. **Schema**: Import from URL
   ```
   https://your-app.vercel.app/api/v1/openapi.json
   ```

2. **Authentication**: API Key
   - **Header name**: `Authorization`
   - **API Key**: `Bearer YOUR_OVENLOVIN_API_KEY`

3. **Privacy policy URL** (if publishing):
   ```
   https://your-app.vercel.app/privacy
   ```

### Available Actions

Once configured, ChatGPT can call:
- `GET /api/v1/recipes` - List recipes
- `GET /api/v1/recipes/{id}` - Get recipe details
- `POST /api/v1/recipes/import` - Import from URL/text (`source` + `content`; persist only with `save:true`)
- `GET /api/v1/households`, `GET /api/v1/people`, `GET /api/v1/people/{id}/rules` - Household context
- `POST /api/v1/meal-plans` - Create meal plan
- `POST /api/v1/meal-plans/{id}/check` - Check meal plan for allergens
- `GET /api/v1/meal-plans/{id}/shopping-list` - Generate shopping list

### Testing

In ChatGPT:
```
Search my recipes for "pasta" and check if any would be safe for everyone in my household
```

## REST API

### Base URL

```
https://your-app.vercel.app/api/v1
```

### Authentication

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-app.vercel.app/api/v1/recipes
```

### Example Endpoints

**List Recipes**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-app.vercel.app/api/v1/recipes?limit=10"
```

Response:
```json
{
  "items": [
    {
      "id": "recipe-123",
      "title": "Spaghetti Carbonara",
      "cuisine": "Italian",
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 20
    }
  ],
  "hasMore": false,
  "nextCursor": null
}
```

**Get Household Context**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-app.vercel.app/api/v1/households/household-123/context"
```

Response:
```json
{
  "household": {
    "id": "household-123",
    "name": "The Smiths"
  },
  "people": [
    {
      "id": "person-1",
      "displayName": "Parent A",
      "rules": [
        {
          "id": "rule-1",
          "kind": "allergen",
          "target": "peanut",
          "severity": "block"
        }
      ]
    }
  ]
}
```

**Check Meal Plan**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  "https://your-app.vercel.app/api/v1/meal-plans/plan-123/check"
```

Response:
```json
{
  "status": "complete",
  "findings": {
    "block": [
      {
        "personId": "person-1",
        "personName": "Parent A",
        "severity": "block",
        "ingredientName": "peanuts",
        "message": "Parent A: recipe contains peanuts (block rule)"
      }
    ],
    "warn": [],
    "prefer_avoid": []
  },
  "summary": {
    "affectedPeople": ["person-1"],
    "entriesWithBlocks": 1,
    "entriesWithWarnings": 0
  }
}
```

### Pagination

OvenLovin uses cursor-based pagination:

```bash
# First page
curl "https://your-app.vercel.app/api/v1/recipes?limit=10"

# Next page (use nextCursor from previous response)
curl "https://your-app.vercel.app/api/v1/recipes?limit=10&cursor=abc123"
```

### Error Handling

Errors follow [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457):

```json
{
  "type": "https://ovenlovin.example/errors/not-found",
  "title": "Recipe not found",
  "status": 404,
  "detail": "Recipe with ID 'recipe-123' does not exist",
  "instance": "/api/v1/recipes/recipe-123"
}
```

## OpenAPI Integration

### Access the OpenAPI Spec

Download the OpenAPI specification:

```bash
curl https://your-app.vercel.app/api/v1/openapi.json > openapi.json
```

### Use with Tools

**Postman**: Import the OpenAPI JSON to generate a collection

**Swagger UI**: Host the spec for interactive docs:
```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/openapi.json \
  -v ./openapi.json:/openapi.json \
  swaggerapi/swagger-ui
```

**Code Generation**: Use OpenAPI generators:
```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-fetch \
  -o ./generated/ovenlovin-client
```

## Authentication

OvenLovin supports three authentication methods:

### 1. API Keys (Recommended for Bots)

Generate in the OvenLovin dashboard under Settings → API Keys.

**Scopes**: `recipes:read`, `recipes:write`, `plans:read`, `plans:write`, `people:read`, `people:write`, `lists:export`.

Include in the `Authorization` header:
```
Authorization: Bearer rkapi_...
```
or `Authorization: ApiKey rkapi_...`.

### 2. OAuth 2.1 (via Clerk)

For apps building on OvenLovin:

1. Register your app in the Clerk dashboard
2. Request OAuth scopes
3. Use the standard OAuth authorization code flow
4. Exchange code for access token
5. Include token in `Authorization: Bearer {token}` header

### 3. Session Tokens (Web UI)

For the Next.js web UI, session cookies are automatically included in same-origin requests.

## Available Tools & Resources

### MCP Tools

Registered tools: `whoami`, `search_recipes`, `get_recipe`, `create_recipe`, `import_recipe`, `import_recipe_from_image`, `delete_recipe`, `get_household_context`, `manage_household_schedule`, `manage_household_settings`, `manage_kitchen_invites`, `manage_kitchen_members`, `get_person_rules`, `manage_people`, `manage_person_rules`, `manage_person_loves`, `check_meal_plan`, `export_shopping_list`, `save_meal_plan`, `get_meal_plan`, `edit_meal_plan`, `delete_meal_plan`, `list_cookbooks`, `get_cookbook`, `manage_cookbook`, `reorder_people`.

See [MCP tools](mcp-tools.md).

### MCP Resources

- `ovenlovin://household/{id}/profile`
- `ovenlovin://household/{id}/schedule`
- `ovenlovin://household/{id}/people`

## Example Workflows

### Example 1: Sunday Meal Planning Bot

```
User: "Plan my meals for next week"

Bot calls:
1. get_household_context() → learns about family members and dietary rules
2. search_recipes(cuisine="Italian", prepTimeMinutes_lte=30) → finds quick recipes
3. save_meal_plan(entries=[...]) → creates draft plan
4. check_meal_plan(planId) → verifies no allergen conflicts
5. export_shopping_list(planId) → generates grocery list

Bot responds with:
- Meal plan for the week
- Shopping list organized by grocery store sections
- Allergen warnings (if any)
```

### Example 2: Recipe Import Assistant

```
User: "Import this recipe: https://example.com/chocolate-chip-cookies"

Bot calls:
1. import_recipe(url="https://example.com/chocolate-chip-cookies")
   → Extracts recipe using AI-powered importer
2. get_recipe(recipeId) → Retrieves imported recipe
3. get_household_context() → Gets family rules
4. check_meal_plan(entries=[{recipeId}], attendees=[...])
   → Checks if safe for family

Bot responds with:
- Imported recipe details
- Confidence score (OCR quality, extraction accuracy)
- Safety check results
- Suggestions: "This recipe contains eggs - would you like me to find an egg-free version?"
```

## Troubleshooting

### MCP Connection Issues

**Problem**: Bot can't connect to MCP server

**Solutions**:
1. Verify the MCP endpoint is accessible:
   ```bash
   curl https://your-app.vercel.app/mcp
   ```
   Should return MCP server metadata

2. Check API key is valid:
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
     https://your-app.vercel.app/api/v1/recipes
   ```

### Authentication Errors

**Problem**: 401 Unauthorized

**Solutions**:
- Verify API key format: `Authorization: ApiKey rkapi_...` or `Bearer rkapi_...`
- Check the key is still listed under Settings
- Ensure the key has the required scopes

### Vercel Email Verification

**Problem**: "Please verify your email address" error

**Solution**: Check your email for the Vercel verification link and click it. MCP tools require a verified email for security.

### Database Connection

**Problem**: "Failed to connect to database"

**Solutions**:
1. Verify `DATABASE_URL` is set correctly in environment variables
2. Check Neon database is accessible
3. Ensure IP allowlist includes your deployment (Vercel sets this automatically)

### Need Help?

- **Documentation**: [GitHub README](https://github.com/tbarho/ovenlovin)
- **Issues**: [GitHub Issues](https://github.com/tbarho/ovenlovin/issues)
- **Spec**: [GitHub Issue #1](https://github.com/tbarho/ovenlovin/issues/1)

---

Built with ❤️ for AI-powered family meal planning
