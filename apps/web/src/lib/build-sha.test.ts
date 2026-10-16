import { describe, expect, it } from "vitest";
import { shortBuildSha } from "./build-sha";

describe("shortBuildSha", () => {
  it("returns the first seven characters of the Vercel commit SHA", () => {
    expect(
      shortBuildSha({ NODE_ENV: "test", VERCEL_GIT_COMMIT_SHA: "69bb6d7abcdef0123456789" })
    ).toBe("69bb6d7");
  });

  it("returns null when the deploy has no commit SHA", () => {
    expect(shortBuildSha({ NODE_ENV: "test" })).toBeNull();
  });
});
