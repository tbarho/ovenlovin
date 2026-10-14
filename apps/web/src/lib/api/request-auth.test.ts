import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "./errors";
import { restAuthFromHeader } from "./request-auth";

describe("restAuthFromHeader", () => {
  it("treats a missing header as a session so the kitchen UI still works", () => {
    expect(restAuthFromHeader(null)).toEqual({ kind: "session" });
    expect(restAuthFromHeader("   ")).toEqual({ kind: "session" });
  });

  it("accepts ApiKey, apikey, and Bearer rkapi_ tokens", () => {
    expect(restAuthFromHeader("ApiKey rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
    expect(restAuthFromHeader("apikey  rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
    expect(restAuthFromHeader("Bearer rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
    expect(restAuthFromHeader("rkapi_abc")).toEqual({
      kind: "apiKey",
      token: "rkapi_abc",
    });
  });

  it("leaves a Clerk JWT bearer for the session path", () => {
    expect(restAuthFromHeader("Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig")).toEqual({
      kind: "session",
    });
  });

  it("throws a JSON 401 for an empty ApiKey scheme", () => {
    expect(() => restAuthFromHeader("ApiKey   ")).toThrow(UnauthorizedError);
  });
});
