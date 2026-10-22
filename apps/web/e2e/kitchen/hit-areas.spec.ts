import { expect, test, type Locator } from "@playwright/test";

/** Visible border boxes at 390 on main. Layout shift fails the test. */
const MAIN_VISUAL = {
  recipeActions: { width: 32, height: 32 },
  servingsSlider: { height: 16 },
  planView: { width: 190, height: 20.8 },
  noCook: { width: 120, height: 34 },
  editorClose: { width: 63, height: 34 },
  gateClose: { width: 50, height: 24.4 },
  toastUndo: { width: 54, height: 27.6 },
  toastDismiss: { width: 75, height: 27.6 },
  demoDismiss: { width: 59, height: 22.8 },
  demoReset: { width: 90, height: 21.2 },
} as const;

async function measureControl(locator: Locator, axis: "both" | "y") {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((el, axis) => {
    const box = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const inset = 0.5;
    const half = 22;
    const raw =
      axis === "both"
        ? [
            { name: "top", x: cx, y: cy - half + inset },
            { name: "bottom", x: cx, y: cy + half - inset },
            { name: "left", x: cx - half + inset, y: cy },
            { name: "right", x: cx + half - inset, y: cy },
          ]
        : [
            { name: "top", x: cx, y: cy - half + inset },
            { name: "bottom", x: cx, y: cy + half - inset },
          ];
    const points = raw
      .map((point) => ({
        ...point,
        x: Math.min(window.innerWidth - inset, Math.max(inset, point.x)),
        y: Math.min(window.innerHeight - inset, Math.max(inset, point.y)),
      }))
      .filter((point) => {
        if (point.name === "top" || point.name === "bottom") {
          return point.y < box.top - 0.25 || point.y > box.bottom + 0.25;
        }
        return point.x < box.left - 0.25 || point.x > box.right + 0.25;
      });
    const hits = points.map((point) => {
      const node = document.elementFromPoint(point.x, point.y);
      return {
        name: point.name,
        ok: Boolean(node && (node === el || el.contains(node))),
        tag: node?.tagName ?? null,
        className: typeof node?.className === "string" ? node.className : "",
      };
    });
    return {
      width: box.width,
      height: box.height,
      inView: box.y >= 0 && box.bottom <= window.innerHeight,
      afterWidth: Number.parseFloat(after.width),
      afterHeight: Number.parseFloat(after.height),
      hits,
    };
  }, axis);
}

async function expectVisibleBox(
  locator: Locator,
  label: string,
  expected: { width?: number; height: number }
) {
  const box = await measureControl(locator, "y");
  expect(box.height, `${label} height`).toBeCloseTo(expected.height, 0);
  if (expected.width != null) {
    expect(box.width, `${label} width`).toBeCloseTo(expected.width, 0);
  }
}

async function expectHit44(locator: Locator, label: string, axis: "both" | "y" = "both") {
  const box = await measureControl(locator, axis);
  expect(box.inView, `${label} in viewport`).toBe(true);
  expect(box.afterHeight, `${label} ::after height`).toBeGreaterThanOrEqual(44);
  if (axis === "both") {
    expect(box.afterWidth, `${label} ::after width`).toBeGreaterThanOrEqual(44);
  }
  expect(box.hits.length, `${label} edge probes`).toBeGreaterThan(0);
  for (const hit of box.hits) {
    expect(hit.ok, `${label} ${hit.name} (${hit.tag ?? "none"} ${hit.className})`).toBe(true);
  }
}

test("kitchen hit areas are at least 44px at 390", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/recipes");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await page
    .getByRole("link", { name: /weeknight dinners/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  const recipeActions = page.getByRole("button", { name: "Recipe actions" }).first();
  await expect(recipeActions).toBeVisible();
  await expectVisibleBox(recipeActions, "recipe actions", MAIN_VISUAL.recipeActions);
  await expectHit44(recipeActions, "recipe actions", "both");

  await page.getByRole("link", { name: /weeknight pesto pasta/i }).click();
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  const slider = page.locator(".servings-stepper input[type='range']");
  const sliderHit = page.locator(".servings-stepper .hit44-y");
  await expect(slider).toBeVisible();
  await slider.scrollIntoViewIfNeeded();
  await expectVisibleBox(slider, "servings slider", MAIN_VISUAL.servingsSlider);
  await expectHit44(sliderHit, "servings slider", "y");

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  const viewLink = page.getByRole("link", { name: /^View / }).first();
  await expect(viewLink).toBeVisible();
  await expectVisibleBox(viewLink, "plan view", MAIN_VISUAL.planView);
  await expectHit44(viewLink, "plan view", "y");

  await page.getByRole("button", { name: /edit monday dinner/i }).click();
  const editor = page.getByTestId(/plan-editor-/);
  await expect(editor).toBeVisible();
  const noCook = editor.getByRole("button", { name: "No-cook night" });
  const editorClose = editor.getByRole("button", { name: "Close" });
  await expectVisibleBox(noCook, "no-cook night", MAIN_VISUAL.noCook);
  await expectVisibleBox(editorClose, "editor close", MAIN_VISUAL.editorClose);
  await expectHit44(noCook, "no-cook night", "y");
  await expectHit44(editorClose, "editor close", "y");

  const blocked = editor.getByRole("button", { name: /not safe for everyone/i });
  if ((await blocked.count()) > 0) await blocked.click();
  await editor.getByRole("button", { name: /kung pao chicken/i }).click();
  const gate = page.getByRole("dialog");
  await expect(gate).toBeVisible();
  const gateClose = gate.getByRole("button", { name: "Close" });
  await expectVisibleBox(gateClose, "safety gate close", MAIN_VISUAL.gateClose);
  await expectHit44(gateClose, "safety gate close", "both");
  await gateClose.click();
  await expect(gate).toHaveCount(0);

  const clear = editor.getByRole("button", { name: "Clear night" });
  if ((await clear.count()) === 0) {
    await noCook.click();
    await expect(clear).toBeVisible();
  }
  await clear.click();
  const toast = page.locator(".kitchen-toast");
  await expect(toast).toBeVisible();
  const undo = toast.getByRole("button", { name: "Undo" });
  const dismiss = toast.getByRole("button", { name: "Dismiss" });
  await expectVisibleBox(undo, "toast undo", MAIN_VISUAL.toastUndo);
  await expectVisibleBox(dismiss, "toast dismiss", MAIN_VISUAL.toastDismiss);
  await expectHit44(undo, "toast undo", "y");
  await expectHit44(dismiss, "toast dismiss", "y");
  await undo.click();

  await page.evaluate(() => {
    const bar = document.createElement("div");
    bar.className = "demo-banner";
    bar.innerHTML =
      '<div class="demo-banner-actions"><button type="button" class="demo-banner-dismiss hit44-y">Dismiss</button><button type="button" class="demo-banner-reset hit44-y">Reset kitchen</button></div>';
    const shell = document.querySelector(".kitchen-shell");
    (shell ?? document.body).prepend(bar);
  });
  const demoDismiss = page.locator(".demo-banner-dismiss");
  const demoReset = page.locator(".demo-banner-reset");
  await expectVisibleBox(demoDismiss, "demo dismiss", MAIN_VISUAL.demoDismiss);
  await expectVisibleBox(demoReset, "demo reset", MAIN_VISUAL.demoReset);
  await expectHit44(demoDismiss, "demo dismiss", "y");
  await expectHit44(demoReset, "demo reset", "y");
});
