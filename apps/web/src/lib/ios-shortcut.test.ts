import { describe, expect, it } from "vitest";
import { iosShortcutUrl } from "./ios-shortcut";

describe("iosShortcutUrl", () => {
  it("hides the add button when the optional link is unset", () => {
    expect(iosShortcutUrl({})).toBeUndefined();
    expect(iosShortcutUrl({ NEXT_PUBLIC_IOS_SHORTCUT_URL: "  " })).toBeUndefined();
  });

  it("returns a published shortcut link when set", () => {
    expect(
      iosShortcutUrl({
        NEXT_PUBLIC_IOS_SHORTCUT_URL: "https://www.icloud.com/shortcuts/example",
      })
    ).toBe("https://www.icloud.com/shortcuts/example");
  });
});
