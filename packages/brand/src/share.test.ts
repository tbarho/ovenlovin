import { describe, expect, it } from "vitest";
import { brandPublicPath } from "./index";
import {
  DOCS_SHARE_ORIGIN,
  absoluteShareUrl,
  appShareOrigin,
  appShareUrl,
  docsShareUrl,
} from "./share";

describe("share URLs", () => {
  it("keeps the docs OG image on the GitHub Pages host, never localhost", () => {
    const url = docsShareUrl(brandPublicPath.og);
    expect(url).toBe("https://tbarho.github.io/ovenlovin/brand/og.png");
    expect(url.startsWith("https://")).toBe(true);
    expect(url).not.toContain("localhost");
    expect(url).not.toContain("127.0.0.1");
    expect(DOCS_SHARE_ORIGIN).toBe("https://tbarho.github.io/ovenlovin");
  });

  it("joins app paths onto the production origin", () => {
    expect(appShareUrl(brandPublicPath.og, {})).toBe("https://ovenlovin.vercel.app/brand/og.png");
    expect(appShareOrigin({ NEXT_PUBLIC_APP_URL: "https://kitchen.example/" })).toBe(
      "https://kitchen.example"
    );
    expect(absoluteShareUrl("https://kitchen.example", "/brand/og.png")).toBe(
      "https://kitchen.example/brand/og.png"
    );
  });

  it("rejects a localhost origin", () => {
    expect(() => absoluteShareUrl("http://localhost:3000", "/brand/og.png")).toThrow(/localhost/);
  });
});
