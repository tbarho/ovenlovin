import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { VERSION } from "@ovenlovin/core";
import { GET } from "./route";

describe("GET /api/v1", () => {
  it("returns a small JSON index instead of 404", async () => {
    const response = GET(new NextRequest("https://kitchen.example/api/v1"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      name?: string;
      version?: string;
      openapi?: string;
      docs?: string;
      mcp?: string;
    };
    expect(body.name).toBe("OvenLovin REST API");
    expect(body.version).toBe(VERSION);
    expect(body.openapi).toBe("https://kitchen.example/api/v1/openapi.json");
    expect(body.docs).toBe("https://kitchen.example/docs");
    expect(body.mcp).toBe("https://kitchen.example/mcp");
  });
});
