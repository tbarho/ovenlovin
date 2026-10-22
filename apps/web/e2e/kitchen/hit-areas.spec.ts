import { expect, test, type Locator, type Page } from "@playwright/test";

const MAIN_HIT_REVERT = `
.kitchen-toast button {
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: inline !important;
}
.recipe-card-more {
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  min-height: 0 !important;
}
.week-editor-actions .btn.compact {
  height: 34px !important;
  min-height: 0 !important;
}
.sheet-close {
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  display: inline !important;
}
.week-meal-open {
  min-width: 0 !important;
  min-height: 0 !important;
  display: inline-block !important;
}
.demo-banner-dismiss,
.demo-banner-reset {
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: inline !important;
}
.servings-card input[type="range"] {
  min-height: 0 !important;
  height: auto !important;
}
`;

async function expectTapTarget(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, label).toBeTruthy();
  if (!box) return;
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
}

async function expectUnder44(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, label).toBeTruthy();
  if (!box) return;
  expect(box.width < 44 || box.height < 44, `${label} under 44 on main`).toBe(true);
}

async function withMainSizes(page: Page, run: () => Promise<void>) {
  const revert = await page.addStyleTag({ content: MAIN_HIT_REVERT });
  try {
    await run();
  } finally {
    await revert.evaluate((el) => el.remove());
  }
}

test("kitchen hit areas are at least 44px at 390", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await page
    .getByRole("link", { name: /weeknight dinners/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  const recipeActions = page.getByRole("button", { name: "Recipe actions" }).first();
  await expect(recipeActions).toBeVisible();
  await withMainSizes(page, () => expectUnder44(recipeActions, "recipe actions"));
  await expectTapTarget(recipeActions, "recipe actions");

  await page.getByRole("link", { name: /weeknight pesto pasta/i }).click();
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Servings" });
  await expect(slider).toBeVisible();
  await withMainSizes(page, () => expectUnder44(slider, "servings slider"));
  await expectTapTarget(slider, "servings slider");

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  const viewLink = page.getByRole("link", { name: /^View / }).first();
  await expect(viewLink).toBeVisible();
  await withMainSizes(page, () => expectUnder44(viewLink, "plan view"));
  await expectTapTarget(viewLink, "plan view");

  await page.getByRole("button", { name: /edit monday dinner/i }).click();
  const editor = page.getByTestId(/plan-editor-/);
  await expect(editor).toBeVisible();
  const noCook = editor.getByRole("button", { name: "No-cook night" });
  const editorClose = editor.getByRole("button", { name: "Close" });
  await withMainSizes(page, async () => {
    await expectUnder44(noCook, "no-cook night");
    await expectUnder44(editorClose, "editor close");
  });
  await expectTapTarget(noCook, "no-cook night");
  await expectTapTarget(editorClose, "editor close");

  const blocked = editor.getByRole("button", { name: /not safe for everyone/i });
  if ((await blocked.count()) > 0) await blocked.click();
  await editor.getByRole("button", { name: /kung pao chicken/i }).click();
  const gate = page.getByRole("dialog");
  await expect(gate).toBeVisible();
  const gateClose = gate.getByRole("button", { name: "Close" });
  await withMainSizes(page, () => expectUnder44(gateClose, "safety gate close"));
  await expectTapTarget(gateClose, "safety gate close");
  await gateClose.click();
  await expect(gate).toHaveCount(0);

  await editor.getByRole("button", { name: "Clear night" }).click();
  const toast = page.locator(".kitchen-toast");
  await expect(toast).toBeVisible();
  const undo = toast.getByRole("button", { name: "Undo" });
  const dismiss = toast.getByRole("button", { name: "Dismiss" });
  await withMainSizes(page, async () => {
    await expectUnder44(undo, "toast undo");
    await expectUnder44(dismiss, "toast dismiss");
  });
  await expectTapTarget(undo, "toast undo");
  await expectTapTarget(dismiss, "toast dismiss");

  await page.evaluate(() => {
    const bar = document.createElement("div");
    bar.className = "demo-banner";
    bar.innerHTML =
      '<div class="demo-banner-actions"><button type="button" class="demo-banner-dismiss">Dismiss</button><button type="button" class="demo-banner-reset">Reset kitchen</button></div>';
    document.body.appendChild(bar);
  });
  const demoDismiss = page.locator(".demo-banner-dismiss");
  const demoReset = page.locator(".demo-banner-reset");
  await withMainSizes(page, async () => {
    await expectUnder44(demoDismiss, "demo dismiss");
    await expectUnder44(demoReset, "demo reset");
  });
  await expectTapTarget(demoDismiss, "demo dismiss");
  await expectTapTarget(demoReset, "demo reset");
});
