import { describe, expect, it } from "vitest";
import {
  handleApiError,
  originFromInstance,
  PROBLEM_TYPE_PLACEHOLDER_ORIGIN,
  problemTypeForInstance,
  UnauthorizedError,
} from "./errors";

describe("problem type URLs", () => {
  it("uses the request origin instead of the placeholder host", () => {
    const instance = "https://ovenlovin-demo.vercel.app/api/v1/recipes";
    expect(originFromInstance(instance)).toBe("https://ovenlovin-demo.vercel.app");
    expect(
      problemTypeForInstance(`${PROBLEM_TYPE_PLACEHOLDER_ORIGIN}/problems/unauthorized`, instance)
    ).toBe("https://ovenlovin-demo.vercel.app/problems/unauthorized");
  });

  it("writes the deploy origin onto UnauthorizedError problem+json", async () => {
    const response = handleApiError(
      new UnauthorizedError("Authentication required"),
      "https://ovenlovin-demo.vercel.app/api/v1/recipes"
    );
    const body = (await response.json()) as { type?: string };
    expect(body.type).toBe("https://ovenlovin-demo.vercel.app/problems/unauthorized");
    expect(body.type).not.toContain("your-app.vercel.app");
  });
});
