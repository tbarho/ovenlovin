import { expect, test } from "@playwright/test";

test.describe("kitchen invites", () => {
  test("settings lists members and can create then revoke an invite", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const pending = await request.get("/api/v1/households/invites");
    expect(pending.ok(), await pending.text()).toBeTruthy();
    const existing = (await pending.json()) as { items?: { id: string }[] };
    for (const invite of existing.items ?? []) {
      const revoked = await request.delete(`/api/v1/households/invites/${invite.id}`);
      expect(revoked.ok(), await revoked.text()).toBeTruthy();
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kitchen members" })).toBeVisible();
    await expect(page.getByLabel("Role for Ty")).toHaveValue("owner", { timeout: 30_000 });

    const invitePanel = page.locator('[aria-labelledby="kitchen-invites-heading"]');
    await expect(invitePanel.getByRole("heading", { name: "Invite links" })).toBeVisible();
    await expect(invitePanel.getByText("No pending invite links.")).toBeVisible();
    await invitePanel.getByRole("button", { name: "Create invite link" }).click();
    await expect(invitePanel.getByText("Copy this link and send it yourself")).toBeVisible();
    const revoke = invitePanel.getByRole("button", { name: "Revoke" });
    await expect(revoke).toHaveCount(1);
    page.once("dialog", (dialog) => dialog.accept());
    // The Revoke button immediately becomes "Revoking…", so a name:"Revoke"
    // count of 0 is not "revoke finished". CI 39290782455 still showed the
    // invite row and a disabled Revoking button after the 5s empty-state wait.
    const revoked = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/households/invites/") &&
        response.request().method() === "DELETE" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await revoke.click();
    await revoked;
    await expect(invitePanel.getByText("No pending invite links.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(invitePanel.getByRole("button", { name: /Revoke/ })).toHaveCount(0);
  });

  test("invite link preview and accept land in the same kitchen", async ({ page, request }) => {
    const created = await request.post("/api/v1/households/invites", {
      data: { role: "member", expiresInDays: 7 },
    });
    expect(created.status(), await created.text()).toBe(201);
    const invite = (await created.json()) as { id?: string; token?: string };
    expect(invite.token).toMatch(/^olinv_[a-f0-9]+$/);

    const preview = await request.get(`/api/v1/invites/${invite.token}`);
    expect(preview.status()).toBe(200);
    const body = (await preview.json()) as { householdName?: string; status?: string };
    expect(body.status).toBe("pending");
    expect(body.householdName).toMatch(/kitchen/i);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/invite/${invite.token}`);
    await expect(page.getByRole("heading", { name: /join /i })).toBeVisible();
    const join = page.getByRole("button", { name: /join /i });
    const accept = page.waitForResponse(
      (response) =>
        response.url().includes("/accept") &&
        response.request().method() === "POST" &&
        response.ok(),
      { timeout: 30_000 }
    );
    await join.click();
    await accept;
    await page.waitForURL("**/recipes", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: /weeknight dinners/i })).toBeVisible();

    if (invite.id) {
      await request.delete(`/api/v1/households/invites/${invite.id}`);
    }
  });
});
