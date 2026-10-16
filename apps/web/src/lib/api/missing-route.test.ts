import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { missingApiMessage, missingApiResponse } from "./missing-route";

describe("missing API routes", () => {
  it("returns problem+json 404 instead of a demo key", async () => {
    const request = new NextRequest("https://ovenlovin-demo.vercel.app/api/v1");
    const response = missingApiResponse(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const body = (await response.json()) as { detail?: string };
    expect(body.detail).toBe(missingApiMessage("/api/v1"));
    expect(body.detail).not.toMatch(/apiKey/i);
  });
});
