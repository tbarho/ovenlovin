import { expect, test, type Locator } from "@playwright/test";

async function expectHit44(locator: Locator, label: string, axis: "both" | "y" = "both") {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.evaluate((el, axis) => {
    const rect = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
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
          return point.y < rect.top - 0.25 || point.y > rect.bottom + 0.25;
        }
        return point.x < rect.left - 0.25 || point.x > rect.right + 0.25;
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
      inView: rect.y >= 0 && rect.bottom <= window.innerHeight,
      afterWidth: Number.parseFloat(after.width),
      afterHeight: Number.parseFloat(after.height),
      hits,
    };
  }, axis);
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
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await page
    .getByRole("link", { name: /weeknight dinners/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  const recipeActions = page.getByRole("button", { name: "Recipe actions" }).first();
  await expect(recipeActions).toBeVisible();
  await expectHit44(recipeActions, "recipe actions", "both");

  const pestoHref = await page
    .getByRole("link", { name: /weeknight pesto pasta/i })
    .getAttribute("href");
  expect(pestoHref).toBeTruthy();
  await page.goto(pestoHref!);
  await expect(
    page.locator(".recipe-layout").getByRole("heading", { name: /pesto pasta/i })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/recipes\/[^/]+/);
  const slider = page.locator(".servings-stepper input[type='range']");
  await expect(slider).toBeVisible();
  await slider.scrollIntoViewIfNeeded();
  const sliderBox = await slider.boundingBox();
  expect(sliderBox, "servings slider box").toBeTruthy();
  if (!sliderBox) return;
  expect(sliderBox.height, "servings slider height").toBeGreaterThanOrEqual(44);
  expect(sliderBox.width, "servings slider width").toBeGreaterThanOrEqual(44);
  const before = await slider.getAttribute("aria-valuenow");
  expect(before).toBeTruthy();
  await page.mouse.click(sliderBox.x + sliderBox.width * 0.8, sliderBox.y + sliderBox.height / 2);
  await expect(slider).not.toHaveAttribute("aria-valuenow", before!);

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  const viewLink = page.getByRole("link", { name: /^View / }).first();
  await expect(viewLink).toBeVisible();
  await expectHit44(viewLink, "plan view", "y");

  await page.getByRole("button", { name: /edit monday dinner/i }).click();
  const editor = page.getByTestId(/plan-editor-/);
  await expect(editor).toBeVisible();
  const noCook = editor.getByRole("button", { name: "No-cook night" });
  const editorClose = editor.getByRole("button", { name: "Close" });
  await expectHit44(noCook, "no-cook night", "y");
  await expectHit44(editorClose, "editor close", "y");

  const blocked = editor.getByRole("button", { name: /not safe for everyone/i });
  if ((await blocked.count()) > 0) await blocked.click();
  await editor.getByRole("button", { name: /kung pao chicken/i }).click();
  const gate = page.getByRole("dialog");
  await expect(gate).toBeVisible();
  const gateClose = gate.getByRole("button", { name: "Close" });
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
  await expectHit44(undo, "toast undo", "y");
  await expectHit44(dismiss, "toast dismiss", "y");
  await undo.click();
});
