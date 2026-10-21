import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  isApiOrMcpPath,
  isApiShapedRequest,
  missingApiMessage,
  missingApiResponse,
} from "./missing-route";

describe("missing API routes", () => {
  it("returns problem+json 404 instead of a demo key", async () => {
    const request = new NextRequest("https://ovenlovin-demo.vercel.app/api/v1");
    const response = missingApiResponse(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const body = (await response.json()) as { detail?: string };
    expect(body.detail).toBe(missingApiMessage("/api/v1"));
    expect(body.detail).toContain("https://ovenlovin-demo.vercel.app/api/demo/enter?format=json");
    expect(body.detail).not.toMatch(/mint a demo key with \/api\/demo\/enter/);
  });

  it("treats ApiKey and JSON Accept as API-shaped, not kitchen HTML", () => {
    expect(
      isApiShapedRequest({
        authorization: "ApiKey rkapi_abc",
        accept: "text/html",
      })
    ).toBe(true);
    expect(
      isApiShapedRequest({
        authorization: "Bearer rkapi_abc",
        accept: "*/*",
      })
    ).toBe(true);
    expect(
      isApiShapedRequest({
        authorization: null,
        accept: "application/json",
      })
    ).toBe(true);
    expect(
      isApiShapedRequest({
        authorization: null,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9",
      })
    ).toBe(false);
    expect(isApiOrMcpPath("/recipes")).toBe(false);
    expect(isApiOrMcpPath("/v1/recipes")).toBe(false);
    expect(isApiOrMcpPath("/meal-plans/x/check")).toBe(false);
    expect(isApiOrMcpPath("/api/recipes")).toBe(true);
    expect(isApiOrMcpPath("/api/v1/recipes")).toBe(true);
    expect(isApiOrMcpPath("/mcp")).toBe(true);
    expect(isApiOrMcpPath("/llms.txt")).toBe(true);
    expect(isApiOrMcpPath("/docs")).toBe(true);
    expect(isApiOrMcpPath("/docs/connect-your-agent")).toBe(true);
    expect(isApiOrMcpPath("/robots.txt")).toBe(true);
  });

  it("returns problem+json 404 for a wrong base path an agent would follow", async () => {
    const request = new NextRequest("https://ovenlovin-demo.vercel.app/recipes", {
      headers: {
        Authorization: "ApiKey rkapi_abc",
        Accept: "application/json",
      },
    });
    const response = missingApiResponse(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    const body = (await response.json()) as { detail?: string; status?: number };
    expect(body.status).toBe(404);
    expect(body.detail).toBe(missingApiMessage("/recipes"));
    expect(body.detail).toMatch(/\/api\/v1\//);
  });
});
