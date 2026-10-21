import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { oas30 } from "openapi3-ts";
import { registerApiPaths } from "./openapi-paths";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registerApiPaths(registry);

export function generateOpenApiDocument(origin?: string): oas30.OpenAPIObject {
  registry.registerComponent("securitySchemes", "apiKey", {
    type: "apiKey",
    in: "header",
    name: "Authorization",
    description:
      "Household API key. Send `ApiKey rkapi_…` or `Bearer rkapi_…`. Create a key under Settings (full access if you omit scopes). A request outside the key's scopes returns 403 with type `<origin>/problems/forbidden`. Bound to one kitchen; a mismatched `X-Kitchen-Id` is rejected.",
  });

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "API key or Clerk JWT",
    description:
      "Same API key as `rkapi_…` (ChatGPT Actions often send Bearer) or a Clerk session JWT. On MCP with a Clerk JWT, optional `X-Kitchen-Id` selects a kitchen you belong to. An API key is bound to one kitchen; a mismatched `X-Kitchen-Id` is rejected.",
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const base = (origin ?? "https://ovenlovin.vercel.app").replace(/\/$/, "");

  return attachForbiddenResponses(
    generator.generateDocument({
      openapi: "3.1.0",
      info: {
        version: "0.1.0",
        title: "OvenLovin API",
        description:
          "The family recipe box your AI can actually use, and it knows who can't eat what. REST for agents. Not medical advice - always check labels.",
        license: {
          name: "MIT",
          url: "https://github.com/tbarho/ovenlovin/blob/main/LICENSE",
        },
        contact: {
          name: "OvenLovin",
          url: "https://github.com/tbarho/ovenlovin",
        },
      },
      servers: [
        {
          url: `${base}/api/v1`,
          description: "This OvenLovin instance",
        },
        {
          url: "http://localhost:3000/api/v1",
          description: "Local development",
        },
      ],
      security: [{ apiKey: [] }, { bearerAuth: [] }],
    })
  );
}

const OPENAPI_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

function attachForbiddenResponses(doc: oas30.OpenAPIObject): oas30.OpenAPIObject {
  const forbidden = {
    description:
      "API key is missing a required scope. Type is `<origin>/problems/forbidden`. Clerk sessions are not scope-checked.",
    content: {
      "application/problem+json": {
        schema: {
          type: "object",
          properties: {
            type: { type: "string", example: "https://ovenlovin.vercel.app/problems/forbidden" },
            title: { type: "string", example: "Forbidden" },
            status: { type: "integer", example: 403 },
            detail: {
              type: "string",
              example:
                "This API key is missing the recipes:write scope. Create a new key in Settings with that scope (or omit scopes for full access).",
            },
          },
        },
      },
    },
  };
  doc.components = doc.components ?? {};
  doc.components.responses = {
    ...doc.components.responses,
    Forbidden: forbidden as oas30.ResponseObject,
  };
  const ref = { $ref: "#/components/responses/Forbidden" };
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const method of OPENAPI_METHODS) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== "object" || !operation.responses) continue;
      if (Array.isArray(operation.security) && operation.security.length === 0) continue;
      if (path === "/api-keys" && method === "post") continue;
      operation.responses["403"] = ref;
    }
  }
  return doc;
}

export { z };
