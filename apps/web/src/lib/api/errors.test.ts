import { describe, expect, it } from "vitest";
import {
  handleApiError,
  isNextRedirectError,
  NotFoundError,
  requireResourceId,
  UnauthorizedError,
} from "./errors";

describe("handleApiError", () => {
  it("returns problem+json 401 for UnauthorizedError", async () => {
    const response = handleApiError(
      new UnauthorizedError("Authentication required"),
      "https://ovenlovin-demo.vercel.app/api/v1/recipes"
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toMatch(/problem\+json/);
    const body = (await response.json()) as { status?: number; title?: string; detail?: string };
    expect(body.status).toBe(401);
    expect(body.title).toBe("Unauthorized");
    expect(body.detail).toMatch(/authentication required/i);
  });

  it("maps a leaked Next.js redirect to problem+json 401, not 500", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/api/demo/enter?next=%2Frecipes;307;",
    });
    expect(isNextRedirectError(redirectError)).toBe(true);

    const response = handleApiError(
      redirectError,
      "https://ovenlovin-demo.vercel.app/api/v1/recipes"
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toMatch(/problem\+json/);
    const body = (await response.json()) as { status?: number; title?: string };
    expect(body.status).toBe(401);
    expect(body.title).toBe("Unauthorized");
  });

  it("returns problem+json 404 for a malformed meal plan id", async () => {
    expect(() => requireResourceId("MealPlan", "x")).toThrow(NotFoundError);

    const response = handleApiError(
      new NotFoundError("MealPlan", "x"),
      "https://ovenlovin-demo.vercel.app/api/v1/meal-plans/x/check"
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(/problem\+json/);
    const body = (await response.json()) as { status?: number; title?: string; detail?: string };
    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
    expect(body.detail).toMatch(/MealPlan with id x not found/);
  });
});
