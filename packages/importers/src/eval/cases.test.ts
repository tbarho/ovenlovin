import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHOTO_CASES, PASTE_CASES, URL_CASES, resolveEvalModels } from "./cases";

describe("import eval fixtures", () => {
  it("keeps eight cases per job", () => {
    expect(PASTE_CASES).toHaveLength(8);
    expect(PHOTO_CASES).toHaveLength(8);
    expect(URL_CASES).toHaveLength(8);
    expect(URL_CASES.some((item) => item.id === "smitten-kitchen-slow-roasted-tomatoes")).toBe(
      true
    );
  });

  it("has photo files on disk", () => {
    for (const item of PHOTO_CASES) {
      expect(item.imagePath && existsSync(item.imagePath), item.id).toBe(true);
    }
  });

  it("honors EVAL_IMPORT_MODEL", () => {
    expect(resolveEvalModels({ EVAL_IMPORT_MODEL: "openai/gpt-6-luna" })).toEqual([
      "openai/gpt-6-luna",
    ]);
  });
});
