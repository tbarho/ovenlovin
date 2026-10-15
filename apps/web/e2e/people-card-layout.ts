import { expect, type Page } from "@playwright/test";

export async function expectPeopleCardsStretchInRows(page: Page) {
  const boxes = await page.locator(".olp-person-card").evaluateAll((els) =>
    els.map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    })
  );
  expect(boxes.length).toBeGreaterThan(0);
  const groups: Array<typeof boxes> = [];
  for (const box of boxes) {
    const group = groups.find((members) => Math.abs((members[0]?.top ?? 0) - box.top) < 8);
    if (group) group.push(box);
    else groups.push([box]);
  }
  for (const group of groups) {
    const heights = group.map((box) => box.height);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
  }
}

export async function expectSnugFilledLanes(page: Page) {
  const lanes = page.locator(".olp-person-card-lane:not(.is-empty)");
  const count = await lanes.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const lane = lanes.nth(index);
    const chips = lane.locator(".olp-person-card-chips");
    const lastChip = lane.locator(".olp-chip-drag, .olp-person-card-more").last();
    const chipsBox = await chips.boundingBox();
    const lastBox = await lastChip.boundingBox();
    const laneBox = await lane.boundingBox();
    expect(chipsBox && lastBox && laneBox).toBeTruthy();
    if (!chipsBox || !lastBox || !laneBox) continue;
    expect(chipsBox.y + chipsBox.height - (lastBox.y + lastBox.height)).toBeLessThan(6);
    const padBottom = await lane.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(laneBox.y + laneBox.height - (chipsBox.y + chipsBox.height)).toBeLessThan(padBottom + 2);
  }
}
