# REST API

> **Status:** Shipped

Bot-first REST API with OpenAPI 3.1 spec generation.

## Structure

```
src/
├── app/api/v1/           # API routes (Next.js App Router)
│   ├── health/
│   ├── openapi.json/
│   ├── recipes/
│   ├── cookbooks/
│   ├── uploads/
│   ├── people/
│   ├── households/
│   └── meal-plans/{id}/shopping-list/
└── lib/api/              # API utilities
    ├── errors.ts         # problem+json error handling
    ├── middleware.ts     # auth & idempotency
    ├── openapi.ts        # OpenAPI generation
    └── response.ts       # response helpers
```

## Features

- **OpenAPI 3.1** schema generation from zod
- **problem+json** error responses (RFC 9457)
- **Cursor pagination** for list endpoints
- **Idempotency keys** on write operations
- **Auth**: `ApiKey rkapi_...`, `Bearer rkapi_...`, or `Bearer <Clerk JWT>`

## Authentication

### User authentication (Clerk JWT)

```bash
curl -H "Authorization: Bearer <jwt>" \
  https://your-app.vercel.app/api/v1/recipes
```

### Bot authentication (API key)

```bash
curl -H "Authorization: ApiKey <key>" \
  https://your-app.vercel.app/api/v1/recipes
```

## Pagination

List endpoints use cursor pagination:

```bash
GET /api/v1/recipes?limit=20&cursor=<cursor>
```

Response:

```json
{
  "items": [...],
  "nextCursor": "abc123",
  "hasMore": true
}
```

## Idempotency

`Idempotency-Key` (trimmed, first 512 characters) is honored on `POST /recipes`, `POST /recipes/import` with `save: true`, and `POST /recipes/import/photo` with `save: true`. A replay returns 200 with the original resource.

```bash
curl -X POST \
  -H "Authorization: Bearer <jwt>" \
  -H "Idempotency-Key: <uuid>" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Recipe"}' \
  https://your-app.vercel.app/api/v1/recipes
```

## Errors

All errors follow RFC 9457 (problem+json):

```json
{
  "type": "https://your-app.vercel.app/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Recipe with id abc123 not found",
  "instance": "https://your-app.vercel.app/api/v1/recipes/abc123"
}
```

## OpenAPI Spec

View the full OpenAPI 3.1 spec:

```bash
curl https://your-app.vercel.app/api/v1/openapi.json
```

## Testing

```bash
# Start dev server
pnpm dev

# Health check
curl http://localhost:3000/api/v1/health

# OpenAPI spec
curl http://localhost:3000/api/v1/openapi.json
```

## Adding a New Endpoint

1. Create route file: `src/app/api/v1/<resource>/route.ts`
2. Define zod schema with `.openapi()` extension
3. Register path in `src/lib/api/openapi.ts` registry
4. Implement GET/POST/PATCH/DELETE handlers
5. Use error handling and response helpers
6. Add tests

Example:

```typescript
import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { z, registry } from "@/lib/api/openapi";

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
}).openapi("Item");

registry.registerPath({
  method: "get",
  path: "/items/{id}",
  tags: ["items"],
  summary: "Get item by ID",
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Item found",
      content: {
        "application/json": {
          schema: itemSchema,
        },
      },
    },
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = { id: params.id, name: "Example" };
    return jsonResponse(item);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
```
