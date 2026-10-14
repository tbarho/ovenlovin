import { describe, expect, it } from "vitest";
import { generateOpenApiDocument } from "./openapi";

describe("generateOpenApiDocument", () => {
  it("uses this instance as the server URL and documents API key auth", () => {
    const spec = generateOpenApiDocument("https://kitchen.example");
    expect(spec.servers?.[0]?.url).toBe("https://kitchen.example/api/v1");
    expect(spec.servers?.[0]?.url).not.toContain("your-app.vercel.app");
    expect(spec.info.version).toBe("0.1.0");
    expect(spec.components?.securitySchemes).toHaveProperty("apiKey");
    expect(spec.security).toEqual([{ apiKey: [] }, { bearerAuth: [] }]);
  });

  it("includes meal plans, households, people, and api-keys", () => {
    const spec = generateOpenApiDocument("https://ovenlovin.vercel.app");
    const paths = Object.keys(spec.paths ?? {});
    expect(paths).toEqual(
      expect.arrayContaining([
        "/recipes",
        "/recipes/{id}",
        "/meal-plans",
        "/meal-plans/{id}",
        "/meal-plans/{id}/check",
        "/meal-plans/{id}/shopping-list",
        "/households",
        "/people",
        "/people/{id}",
        "/people/{id}/rules",
        "/people/{id}/preferences",
        "/api-keys",
      ])
    );
    expect(spec.paths?.["/recipes"]?.get).toBeTruthy();
    expect(JSON.stringify(spec.paths?.["/recipes"]?.get)).toContain("forAttendees");
    expect(spec.paths?.["/recipes"]?.post).toBeTruthy();
    expect(spec.paths?.["/recipes/{id}"]?.delete).toBeTruthy();
    expect(spec.paths?.["/meal-plans/{id}"]?.delete).toBeTruthy();
  });
});
