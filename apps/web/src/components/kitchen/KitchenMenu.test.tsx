import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";

const pathname = vi.hoisted(() => vi.fn(() => "/recipes"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { KitchenMenu } from "./KitchenMenu";

const kitchens = [
  { household: { id: "kitchen-a", name: "Kitchen A" }, membership: { role: "owner" } },
  { household: { id: "kitchen-b", name: "Kitchen B" }, membership: { role: "member" } },
];

describe("KitchenMenu", () => {
  beforeEach(() => {
    pathname.mockReturnValue("/recipes");
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({
      items: kitchens,
      activeHouseholdId: "kitchen-a",
    });
  });

  it("opens a sheet of kitchen destinations and marks the current page", async () => {
    const user = userEvent.setup();
    render(
      <KitchenMenu>
        <button type="button">Account</button>
      </KitchenMenu>
    );

    const trigger = screen.getByRole("button", { name: "Open kitchen menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("link", { name: "Recipes" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(dialog).getByRole("link", { name: "Plan" })).not.toHaveAttribute("aria-current");
    expect(within(dialog).getByRole("link", { name: "List" })).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "People" })).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Settings" })).toBeVisible();
    expect(await within(dialog).findByLabelText("Active kitchen")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Account" })).toBeVisible();
  });

  it("closes on overlay, Escape, navigation, and returns focus to the button", async () => {
    const user = userEvent.setup();
    render(<KitchenMenu />);
    const trigger = screen.getByRole("button", { name: "Open kitchen menu" });

    await user.click(trigger);
    await user.click(
      within(screen.getByRole("dialog", { name: "Menu" })).getByRole("button", { name: "Close" })
    );
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(document.querySelector(".sheet-backdrop") as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    const recipes = screen.getByRole("link", { name: "Recipes" });
    recipes.addEventListener("click", (event) => event.preventDefault());
    await user.click(recipes);
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("closes after the route changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<KitchenMenu />);
    await user.click(screen.getByRole("button", { name: "Open kitchen menu" }));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeVisible();
    pathname.mockReturnValue("/people");
    rerender(<KitchenMenu />);
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("traps tab focus inside the open sheet", async () => {
    const user = userEvent.setup();
    render(<KitchenMenu />);
    await user.click(screen.getByRole("button", { name: "Open kitchen menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    const close = within(dialog).getByRole("button", { name: "Close" });
    close.focus();
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Open kitchen menu" })
    );
  });

  it("closes after a downward swipe on the sheet", async () => {
    render(<KitchenMenu />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open kitchen menu" }));
    const handle = document.querySelector(".sheet-handle") as HTMLElement;
    expect(handle).toBeTruthy();
    act(() => {
      firePointer(handle, "pointerdown", 40);
      firePointer(window, "pointermove", 160);
      firePointer(window, "pointerup", 160);
    });
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });
});

function firePointer(element: EventTarget, type: string, clientY: number) {
  const init = {
    bubbles: true,
    cancelable: true,
    clientY,
    button: 0,
    pointerId: 1,
    pointerType: "touch",
  };
  const event =
    typeof PointerEvent === "function" ? new PointerEvent(type, init) : new MouseEvent(type, init);
  element.dispatchEvent(event);
}
