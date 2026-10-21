import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { VERSION } from "@ovenlovin/core";
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
      "Household API key. Send `ApiKey rkapi_…` or `Bearer rkapi_…`. Create a key under Settings. Bound to one kitchen; a mismatched `X-Kitchen-Id` is rejected.",
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

  return withSharedErrorResponses(
    generator.generateDocument({
      openapi: "3.1.0",
      info: {
        version: VERSION,
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

const SHARED_ERRORS: Record<string, oas30.ResponseObject> = {
  "400": {
    description:
      "Validation Error. type is <origin>/problems/validation-error. Body includes errors[{path,message,code}].",
  },
  "401": { description: "Unauthorized. Missing or invalid Authorization." },
  "403": {
    description:
      "Forbidden. Role not allowed, kitchen header mismatch, demo write/upload cap, or request outside the key's scopes.",
  },
  "404": {
    description: "Not Found. Missing resource, unknown path, cross-kitchen id, or malformed id.",
  },
};

const PUBLIC_OPS = new Set(["/health", "/status", "/openapi.json", "/invites/{token}"]);

function withSharedErrorResponses(doc: oas30.OpenAPIObject): oas30.OpenAPIObject {
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    for (const method of ["get", "put", "post", "delete", "patch"] as const) {
      const op = item[method];
      if (!op?.responses) continue;
      op.responses["400"] ??= SHARED_ERRORS["400"];
      op.responses["404"] ??= SHARED_ERRORS["404"];
      if (!PUBLIC_OPS.has(path) || method !== "get") {
        op.responses["401"] ??= SHARED_ERRORS["401"];
        op.responses["403"] ??= SHARED_ERRORS["403"];
      }
    }
  }
  return doc;
}

export { z };
