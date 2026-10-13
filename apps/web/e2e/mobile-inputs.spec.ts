import { expect, test } from "@playwright/test";

const APP_TEXT_FIELDS = [
  ".form-card input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range])",
  ".form-card textarea",
  ".form-card select",
  ".field input",
  ".field textarea",
  ".sheet-body input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range])",
  ".sheet-body textarea",
  ".sheet-body select",
  ".key-create input",
].join(", ");

async function measureInjectedFormControls(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const host = document.createElement("form");
    host.className = "form-card";
    host.setAttribute("data-font-probe", "true");

    const labeled = document.createElement("label");
    labeled.append("Title");
    const input = document.createElement("input");
    labeled.append(input);

    const field = document.createElement("label");
    field.className = "field";
    const fieldLabel = document.createElement("span");
    fieldLabel.className = "field-label";
    fieldLabel.textContent = "Name";
    const fieldInput = document.createElement("input");
    field.append(fieldLabel, fieldInput);

    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    select.append(document.createElement("option"));

    host.append(labeled, field, textarea, select);
    document.body.append(host);

    const sizes = [input, fieldInput, textarea, select].map((el) =>
      parseFloat(getComputedStyle(el).fontSize)
    );
    host.remove();
    return sizes;
  });
}

test.describe("mobile form controls", () => {
  test.skip(({ isMobile }) => !isMobile, "iOS zoom check is mobile-viewport only");

  test("text fields are at least 16px, including label-wrapped inputs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const injected = await measureInjectedFormControls(page);
    for (const fontSize of injected) {
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }

    const live = page.locator(APP_TEXT_FIELDS);
    const count = await live.count();
    for (let index = 0; index < count; index += 1) {
      const fontSize = await live
        .nth(index)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test("does not lock pinch-zoom with a maximum-scale viewport", async ({ page }) => {
    await page.goto("/");
    const content = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(content ?? "").not.toMatch(/maximum-scale/i);
    expect(content ?? "").not.toMatch(/user-scalable\s*=\s*no/i);
  });
});
