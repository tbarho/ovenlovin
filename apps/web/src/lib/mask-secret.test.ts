import { describe, expect, it } from "vitest";
import { maskSecret } from "./mask-secret";

describe("maskSecret", () => {
  it("keeps a short prefix and suffix so the key is recognizable", () => {
    expect(maskSecret("olv_sandbox_key_abcd")).toBe("olv_••••••••••••abcd");
  });

  it("fully masks short values", () => {
    expect(maskSecret("abcd")).toBe("••••");
  });
});
