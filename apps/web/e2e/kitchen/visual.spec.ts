import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const WIDTHS = [1440, 1280, 1024, 768, 390] as const;
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen");
const label = process.env.E2E_SHOT_LABEL || "current";

type KitchenUrls = {
  cookbookHref: string;
  pestoHref: string;
  jakeHref: string;
  tyHref: string;
};

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
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

  await page.goto("/people");
  await expect(page.getByText("Jake")).toBeVisible();
  const jakeHref = await page.locator("a").filter({ hasText: "Jake" }).first().getAttribute("href");
  expect(jakeHref).toBeTruthy();
  const tyHref = await page.locator("a").filter({ hasText: "Ty" }).first().getAttribute("href");
  expect(tyHref).toBeTruthy();

  return {
    cookbookHref: cookbookHref!,
    pestoHref: pestoHref!,
    jakeHref: jakeHref!,
    tyHref: tyHref!,
  };
}

async function captureWidth(page: Page, width: number, urls: KitchenUrls) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await shot(page, width, "recipes-list");
  await openSheet(page, /new cookbook/i);
  await shot(page, width, "sheet-new-cookbook");
  await closeSheet(page);

  await page.goto(urls.cookbookHref);
  await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
  await shot(page, width, "cookbook");
  await openSheet(page, /rename/i);
  await shot(page, width, "sheet-rename-cookbook");
  await closeSheet(page);
  await page.getByRole("button", { name: /delete/i }).click();
  await expect(page.getByRole("dialog", { name: /delete cookbook/i })).toBeVisible();
  await shot(page, width, "sheet-delete-cookbook");
  await closeSheet(page);

  await page.goto(urls.pestoHref);
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  await expect(page.getByTestId("who-can-eat")).toBeVisible();
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
  await page.getByTestId("bucket-cant_eat").getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("dialog", { name: /can't eat/i })).toBeVisible();
  await shot(page, width, "sheet-add-rule");
  await closeSheet(page);
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

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  await expect(page.getByText(/grok kitchen key/i)).toBeVisible();
  await shot(page, width, "settings");
}

test.describe("signed-in kitchen visual harness", () => {
  test.describe.configure({ mode: "serial" });

  let urls: KitchenUrls | undefined;

  for (const width of WIDTHS) {
    test(`captures ${width}px pages and sheets`, async ({ page }) => {
      test.setTimeout(90_000);
      urls = urls ?? (await discoverKitchen(page));
      await captureWidth(page, width, urls);
    });
  }
});
