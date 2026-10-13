import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { oas30 } from "openapi3-ts";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

export function generateOpenApiDocument(): oas30.OpenAPIObject {
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Clerk JWT token for authenticated users",
  });

  registry.registerComponent("securitySchemes", "apiKey", {
    type: "apiKey",
    in: "header",
    name: "Authorization",
    description: "API key for bot clients. Format: `ApiKey <key>`",
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      version: "1.0.0",
      title: "OvenLovin API",
      description:
        "LLM-optimized recipe & family meal-planning API. Bot-first interfaces for Grok, ChatGPT, Claude, and other AI agents.",
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
        url: "https://your-app.vercel.app/api/v1",
        description: "Your OvenLovin instance",
      },
      {
        url: "http://localhost:3000/api/v1",
        description: "Local development",
      },
    ],
  });
}

export { z };
