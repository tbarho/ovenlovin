import { describe, expect, it } from "vitest";
import {
  CONSENT_BUTTON_LABELS,
  CONSENT_BUTTON_SELECTORS,
  STEALTH_INIT_SCRIPT,
  isConsentButtonLabel,
} from "./import-page-render";

describe("headless stealth helpers", () => {
  it("matches common consent labels without treating nearby text as a match", () => {
    expect(isConsentButtonLabel("Accept all")).toBe(true);
    expect(isConsentButtonLabel("I agree")).toBe(true);
    expect(isConsentButtonLabel("Got it")).toBe(true);
    expect(isConsentButtonLabel("Save preferences")).toBe(false);
    expect(CONSENT_BUTTON_LABELS).toContain("accept all");
    expect(CONSENT_BUTTON_SELECTORS).toContain("#onetrust-accept-btn-handler");
  });

  it("hides webdriver and pretends to be Chrome", () => {
    expect(STEALTH_INIT_SCRIPT).toMatch(/webdriver/);
    expect(STEALTH_INIT_SCRIPT).toMatch(/window\.chrome/);
    expect(STEALTH_INIT_SCRIPT).toMatch(/languages/);
  });
});
