import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { expectPeopleCardsStretchInRows, expectSnugFilledLanes } from "../people-card-layout";

const WIDTHS = [1440, 1280, 1024, 768, 390] as const;
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen");
const label = process.env.E2E_SHOT_LABEL || "current";

type KitchenUrls = {
  cookbookHref: string;
  emptyCookbookHref: string;
  pestoHref: string;
  jakeHref: string;
  tyHref: string;
};

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
}

async function expectPeopleDragHandlesTopRight(page: Page) {
  const cards = page.locator(".olp-person-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.getByTestId("people-reorder")).toHaveCount(1);
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const handle = card.getByRole("button", { name: /^Reorder / });
    await expect(handle).toHaveCount(1);
    await expect(card).toHaveCSS("position", "relative");
    await expect(handle).toHaveCSS("position", "absolute");
    const pad = await card.evaluate((el) => getComputedStyle(el).paddingTop);
    expect(pad).toBe("8px");
    await expect(handle).toHaveCSS("top", pad);
    await expect(handle).toHaveCSS("right", pad);
    const handleBox = await handle.boundingBox();
    const nameBox = await card.locator(".olp-person-identity").boundingBox();
    expect(handleBox && nameBox).toBeTruthy();
    if (!handleBox || !nameBox) continue;
    expect(handleBox.width).toBeGreaterThanOrEqual(44);
    expect(handleBox.height).toBeGreaterThanOrEqual(44);
    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(handleBox.x + 1);
  }
}

async function shot(page: Page, width: number, name: string) {
  await settle(page);
  await page.screenshot({
    path: path.join(shotRoot, label, `${width}-${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function openSheet(page: Page, buttonName: string | RegExp) {
  await page.getByRole("button", { name: buttonName }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function closeSheet(page: Page) {
  const dialog = page.getByRole("dialog");
  if (!(await dialog.isVisible().catch(() => false))) return;
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

async function discoverKitchen(page: Page): Promise<KitchenUrls> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /weeknight dinners/i })).toBeVisible();

  const cookbookHref = await page
    .getByRole("link", { name: /weeknight dinners/i })
    .first()
    .getAttribute("href");
  expect(cookbookHref).toBeTruthy();

  await page.goto(cookbookHref!);
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  const pestoHref = await page
    .getByRole("link", { name: /weeknight pesto pasta/i })
    .getAttribute("href");
  expect(pestoHref).toBeTruthy();

  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: /scratch book/i })).toBeVisible();
  const emptyCookbookHref = await page
    .getByRole("link", { name: /scratch book/i })
    .first()
    .getAttribute("href");
  expect(emptyCookbookHref).toBeTruthy();

  await page.goto("/people");
  await expect(page.getByText("Jake")).toBeVisible();
  const jakeHref = await page.locator("a").filter({ hasText: "Jake" }).first().getAttribute("href");
  expect(jakeHref).toBeTruthy();
  const tyHref = await page.locator("a").filter({ hasText: "Ty" }).first().getAttribute("href");
  expect(tyHref).toBeTruthy();

  return {
    cookbookHref: cookbookHref!,
    emptyCookbookHref: emptyCookbookHref!,
    pestoHref: pestoHref!,
    jakeHref: jakeHref!,
    tyHref: tyHref!,
  };
}

async function captureWidth(page: Page, width: number, urls: KitchenUrls) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  if (width === 390 || width === 1440) {
    const firstCard = page.locator("a.recipe-card").first();
    await expect(firstCard).toBeVisible();
    const box = await firstCard.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    if (box && viewport) {
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeLessThan(viewport.height);
    }
  }
  await shot(page, width, "recipes-list");
  if (width === 390) {
    await page.getByRole("button", { name: "Open kitchen menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await shot(page, width, "sheet-kitchen-menu");
    await closeSheet(page);
  }
  await openSheet(page, /new cookbook/i);
  await shot(page, width, "sheet-new-cookbook");
  await closeSheet(page);

  await page.goto(urls.cookbookHref);
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add recipes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recipe actions" }).first()).toBeVisible();
  await shot(page, width, "cookbook");
  await openSheet(page, /^add recipes$/i);
  await expect(page.getByRole("dialog", { name: "Add recipes" })).toBeVisible();
  await expect(page.getByText("Already in this book").first()).toBeVisible();
  await shot(page, width, "sheet-add-recipes");
  await closeSheet(page);
  await page.goto(urls.emptyCookbookHref);
  await expect(page.getByText("This cookbook is empty.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add recipes" }).nth(1)).toBeVisible();
  await shot(page, width, "cookbook-empty");
  await openSheet(page, /^add recipes$/i);
  await shot(page, width, "sheet-add-recipes-empty");
  await closeSheet(page);
  await page.goto(urls.cookbookHref);
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  await openSheet(page, /rename/i);
  await shot(page, width, "sheet-rename-cookbook");
  await closeSheet(page);
  await page.getByRole("button", { name: /delete/i }).click();
  await expect(page.getByRole("dialog", { name: /delete cookbook/i })).toBeVisible();
  await shot(page, width, "sheet-delete-cookbook");
  await closeSheet(page);

  await page.goto(urls.pestoHref);
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  await expect(page.getByTestId("scaled-servings-note")).toContainText(
    "Recipe makes 4 · cooking for 5"
  );
  await expect(page.getByRole("button", { name: "Reset to 4" })).toBeVisible();
  await expect(page.getByTestId("who-can-eat")).toBeVisible();
  await expect(page.getByTestId("recipe-main-image")).toHaveCount(1);
  await expect(page.locator(".recipe-thumbs")).toHaveCount(0);
  await expect(page.locator(".recipe-hero img")).toHaveCount(1);
  const who = page.getByTestId("who-can-eat");
  const ingredients = page.getByRole("heading", { name: "Ingredients" });
  const whoBox = await who.boundingBox();
  const ingredientsBox = await ingredients.boundingBox();
  expect(whoBox && ingredientsBox).toBeTruthy();
  if (whoBox && ingredientsBox) {
    expect(ingredientsBox.y - (whoBox.y + whoBox.height)).toBeLessThan(400);
  }
  await shot(page, width, "recipe-detail");
  for (const [button, name] of [
    [/edit details/i, "sheet-recipe-details"],
    [/edit image/i, "sheet-recipe-image"],
    [/edit ingredients/i, "sheet-recipe-ingredients"],
    [/edit steps/i, "sheet-recipe-steps"],
    [/^cookbooks$/i, "sheet-recipe-cookbooks"],
  ] as const) {
    await openSheet(page, button);
    await shot(page, width, name);
    await closeSheet(page);
  }
  await page.getByTestId("who-can-eat").locator("button").filter({ hasText: "Jake" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, width, "sheet-who-can-eat");
  await closeSheet(page);

  await page.goto("/people");
  await expect(page.getByText("Jake")).toBeVisible();
  await expect(page.locator('[data-testid^="person-card-cant_eat-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="person-card-doesnt_like-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="person-card-loves-"]').first()).toBeVisible();
  await expect(
    page.locator('[data-testid^="person-card-loves-"]').filter({ hasText: /salmon/i })
  ).toHaveCount(1);
  await expect(page.locator('[data-testid^="person-card-more-cant_eat-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="person-card-more-doesnt_like-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="person-card-more-loves-"]')).toHaveCount(1);
  await expectPeopleDragHandlesTopRight(page);
  await expectPeopleCardsStretchInRows(page);
  await expectSnugFilledLanes(page);
  await shot(page, width, "people-list");

  await page.goto(urls.tyHref);
  await expect(page.getByRole("heading", { name: "Ty" })).toBeVisible();
  await expect(page.getByTestId("bucket-cant_eat")).toBeVisible();
  await expect(page.getByTestId("bucket-doesnt_like")).toContainText(/cilantro/i);
  await expect(page.getByTestId("bucket-loves")).toContainText(/salmon/i);
  await shot(page, width, "person");

  await page.goto(urls.jakeHref);
  await expect(page.getByRole("heading", { name: "Jake" })).toBeVisible();
  await expect(page.getByTestId("bucket-cant_eat")).toContainText(/peanut/i);
  await expect(page.getByTestId("bucket-doesnt_like")).toBeVisible();
  await expect(page.getByTestId("bucket-loves")).toBeVisible();
  await shot(page, width, "person-jake");
  await page.getByTestId("bucket-cant_eat").getByPlaceholder("Add…").click();
  await expect(page.getByRole("listbox", { name: /can't eat suggestions/i })).toBeVisible();
  await expect(page.getByTestId("tile-milk")).toBeVisible();
  await shot(page, width, "inline-add-rule");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /edit jake/i }).click();
  await expect(page.getByRole("dialog", { name: /edit person/i })).toBeVisible();
  await shot(page, width, "sheet-edit-person");
  await closeSheet(page);
  await page.getByRole("button", { name: /delete jake/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, width, "sheet-delete-person");
  await closeSheet(page);
  await page
    .getByTestId("bucket-cant_eat")
    .getByRole("button")
    .filter({ hasText: /peanut/i })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, width, "sheet-edit-rule");
  await closeSheet(page);

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.getByRole("note")).toBeVisible();
  await expect(page.getByTestId("meal-plan-week")).toBeVisible();
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: /scale shopping and portions for/i })
  ).toHaveValue("5");
  await shot(page, width, "plans-week");

  await page.goto("/list");
  await expect(page.getByRole("heading", { name: "Shopping list" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.getByTestId("shopping-list")).toBeVisible();
  await shot(page, width, "shopping-list");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kitchen name" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Default servings" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Match my family \(5 people\)/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Kitchen members" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite links" })).toBeVisible();
  await expect(page.getByText(/grok kitchen key/i)).toBeVisible({ timeout: 30_000 });
  await shot(page, width, "settings");
}

test.describe("signed-in kitchen visual harness", () => {
  test.describe.configure({ mode: "serial" });

  let urls: KitchenUrls | undefined;

  for (const width of WIDTHS) {
    test(`captures ${width}px pages and sheets`, async ({ page }) => {
      test.setTimeout(120_000);
      urls = urls ?? (await discoverKitchen(page));
      await captureWidth(page, width, urls);
    });
  }
});
