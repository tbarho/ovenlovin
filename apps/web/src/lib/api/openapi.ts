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
      "Household API key. Send `ApiKey rkapi_…` or `Bearer rkapi_…`. Create a key under Settings.",
  });

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "API key or Clerk JWT",
    description:
      "Same API key as `rkapi_…` (ChatGPT Actions often send Bearer) or a Clerk session JWT.",
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const base = (origin ?? "https://ovenlovin.vercel.app").replace(/\/$/, "");

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      version: "0.1.0",
      title: "OvenLovin API",
      description:
        "The family recipe box your AI can actually use, and it knows who can't eat what. REST for agents. Not medical advice — always check labels.",
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
  });
}

export { z };
