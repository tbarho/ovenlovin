import { describe, expect, it } from "vitest";
import { HouseholdAccessError } from "@ovenlovin/core";
import { IMPORT_AI_UNAVAILABLE_CODE, IMPORT_AI_UNAVAILABLE_MESSAGE } from "@ovenlovin/core";
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

  it("maps household access errors to problem+json status codes", async () => {
    const forbidden = handleApiError(
      new HouseholdAccessError(
        "Owner or admin role is required to manage kitchen invites.",
        "forbidden"
      ),
      "https://ovenlovin-demo.vercel.app/api/v1/households/invites"
    );
    expect(forbidden.status).toBe(403);
    const expired = handleApiError(
      new HouseholdAccessError("This invite link has expired.", "expired"),
      "https://ovenlovin-demo.vercel.app/api/v1/invites/olinv_aa/accept"
    );
    expect(expired.status).toBe(410);
    const conflict = handleApiError(
      new HouseholdAccessError(
        "The last owner cannot leave. Promote someone else first.",
        "conflict"
      ),
      "https://ovenlovin-demo.vercel.app/api/v1/households/leave"
    );
    expect(conflict.status).toBe(409);
  });

  it("maps AI_RetryError to 503 import_ai_unavailable with Retry-After", async () => {
    const error = Object.assign(
      new Error(
        "Failed after 3 attempts. Last error: Service temporarily unavailable. Please try again shortly."
      ),
      { name: "AI_RetryError" }
    );
    const response = handleApiError(
      error,
      "https://ovenlovin-demo.vercel.app/api/v1/recipes/import"
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    const body = (await response.json()) as {
      status?: number;
      detail?: string;
      code?: string;
    };
    expect(body.status).toBe(503);
    expect(body.code).toBe(IMPORT_AI_UNAVAILABLE_CODE);
    expect(body.detail).toBe(IMPORT_AI_UNAVAILABLE_MESSAGE);
  });
});
