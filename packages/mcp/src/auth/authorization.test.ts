import { describe, expect, it } from "vitest";
import { parseAuthorizationHeader } from "./authorization";

describe("parseAuthorizationHeader", () => {
  it("accepts ApiKey rkapi_ tokens", () => {
    expect(parseAuthorizationHeader("ApiKey rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
  });

  it("treats Bearer rkapi_ as an API key (ChatGPT / some MCP clients)", () => {
    expect(parseAuthorizationHeader("Bearer rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
  });

  it("treats other Bearer tokens as Clerk JWTs", () => {
    expect(parseAuthorizationHeader("Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig")).toEqual({
      kind: "clerk",
      token: "eyJhbGciOiJIUzI1NiJ9.e30.sig",
    });
  });

  it("accepts a bare rkapi_ token", () => {
    expect(parseAuthorizationHeader("rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
  });

  it("rejects missing or empty headers", () => {
    expect(() => parseAuthorizationHeader(undefined)).toThrow(/Missing Authorization/);
    expect(() => parseAuthorizationHeader("ApiKey  ")).toThrow(/Invalid API key/);
    expect(() => parseAuthorizationHeader("Token abc")).toThrow(/Invalid authorization scheme/);
  });
});
