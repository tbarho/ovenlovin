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
- **Stdio transport**: `npx @ovenlovin/mcp`
- **HTTP transport**: `http://localhost:3000/mcp` (via Next.js web server)

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

Claude Desktop and Claude Code support MCP via both stdio and HTTP transports.

### Stdio Transport (Recommended for Local Development)

Edit Claude's config file:

**macOS/Linux**: `~/.config/claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ovenlovin": {
      "command": "npx",
      "args": ["@ovenlovin/mcp"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### HTTP Transport (Production)

For deployed instances:

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
- `POST /api/v1/recipes/import` - Import from URL/text
- `GET /api/v1/households/{id}/context` - Get household context
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
# JSON
curl https://your-app.vercel.app/api/v1/openapi.json > openapi.json

# YAML
curl https://your-app.vercel.app/api/v1/openapi.yaml > openapi.yaml
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

**Scopes**:
- `recipes:read` - Read recipes
- `recipes:write` - Create/update/import recipes
- `plans:read` - Read meal plans
- `plans:write` - Create/update meal plans
- `household:read` - Read household context
- `household:admin` - Manage household members and rules

Include in the `Authorization` header:
```
Authorization: Bearer olvn_key_abc123...
```

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

The MCP server provides these tools:

#### Recipe Management
- `search_recipes` - Search recipes by text, filters (cuisine, tags, prep time, etc.)
- `get_recipe` - Get full recipe details by ID
- `import_recipe` - Import recipe from URL, text, or photo

#### Household Context
- `get_household_context` - Get household members, dietary rules, and constraints
- `get_person_rules` - Get detailed rules for a specific person

#### Meal Planning
- `save_meal_plan` - Create or update a weekly meal plan
- `get_meal_plan` - Retrieve meal plan details
- `check_meal_plan` - Run allergen and dietary rule checks on a plan

#### Shopping
- `export_shopping_list` - Generate aggregated shopping list with quantities and rule warnings

### MCP Resources

The MCP server also exposes structured data via resource URIs:

- `ovenlovin://household/{id}` - Household details
- `ovenlovin://person/{id}` - Person profile
- `ovenlovin://recipe/{id}` - Recipe data
- `ovenlovin://meal-plan/{id}` - Meal plan

Bots can request these for context without explicit tool calls.

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

3. For stdio transport, ensure `@ovenlovin/mcp` is published or use local path:
   ```json
   {
     "command": "node",
     "args": ["/path/to/ovenlovin/packages/mcp/dist/server.js"]
   }
   ```

### Authentication Errors

**Problem**: 401 Unauthorized

**Solutions**:
- Verify API key format: `Authorization: Bearer olvn_key_...`
- Check key hasn't expired in dashboard
- Ensure key has required scopes for the operation

### Rate Limiting

**Problem**: 429 Too Many Requests

**Response headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
```

**Solution**: Wait until `X-RateLimit-Reset` timestamp or upgrade plan

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
