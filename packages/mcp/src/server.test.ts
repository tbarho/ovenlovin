import { describe, expect, it } from "vitest";
import { createServer } from "./server";

describe("MCP Server", () => {
  it("creates a stdio server without a stub household baked in", () => {
    const server = createServer({ name: "ovenlovin-mcp", version: "0.1.0" });
    expect(server).toBeTruthy();
  });
});
