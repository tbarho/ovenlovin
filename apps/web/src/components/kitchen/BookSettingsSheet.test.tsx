import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/browser-api", () => ({ api: vi.fn() }));

import { api } from "@/lib/browser-api";
import { BookSettingsSheet, bookSettingsBody, coverChoiceOf, moveId } from "./BookSettingsSheet";

const BOOK = "00000000-0000-4000-8000-000000000020";
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const RECIPES = [
  { id: A, title: "Pancakes", image: "/a.jpg" },
  { id: B, title: "Soup", image: null },
  { id: C, title: "Pie", image: "/c.jpg" },
];

afterEach(() => {
  vi.mocked(api).mockReset();
  refresh.mockReset();
});

describe("bookSettingsBody", () => {
  it("maps the cover choice and leaves defaults out", () => {
    const base = { title: "", subtitle: "", dedication: "", includeCards: true };
    expect(bookSettingsBody({ ...base, cover: "auto" })).toEqual({
      title: "",
      subtitle: "",
      dedication: "",
    });
    expect(bookSettingsBody({ ...base, cover: "type" }).cover).toEqual({ kind: "type" });
    expect(bookSettingsBody({ ...base, cover: A, includeCards: false })).toMatchObject({
      cover: { kind: "recipe", recipeId: A },
      includeCards: false,
    });
  });

  it("reads the stored cover back", () => {
    expect(coverChoiceOf({})).toBe("auto");
    expect(coverChoiceOf({ cover: { kind: "type" } })).toBe("type");
    expect(coverChoiceOf({ cover: { kind: "recipe", recipeId: C } })).toBe(C);
  });

  it("moves a recipe one step and stops at the ends", () => {
    expect(moveId([A, B, C], C, -1)).toEqual([A, C, B]);
    expect(moveId([A, B, C], A, -1)).toEqual([A, B, C]);
  });
});

describe("BookSettingsSheet", () => {
  it("uses secondary order-move Buttons and a default Save book Button", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const onClose = vi.fn();
    render(
      <BookSettingsSheet
        bookId={BOOK}
        name="Household 1 kitchen"
        settings={{}}
        recipes={RECIPES}
        open
        onClose={onClose}
      />
    );

    const sheet = screen.getByRole("dialog", { name: "Make it yours" });
    expect(sheet.querySelector(".book-settings")).not.toBeNull();
    expect(sheet.querySelector(".btn")).toBeNull();

    const cover = screen.getByRole("radio", { name: "Pie" });
    expect(cover.tagName).toBe("BUTTON");
    expect(cover).not.toHaveAttribute("data-slot", "button");
    expect(cover).not.toHaveClass("ds-button");

    const up = screen.getByRole("button", { name: "Move Pancakes up" });
    const down = screen.getByRole("button", { name: "Move Pancakes down" });
    expect(up).toHaveAttribute("data-slot", "button");
    expect(up).toHaveAttribute("data-variant", "secondary");
    expect(up).toHaveAttribute("data-size", "md");
    expect(up).toHaveAttribute("type", "button");
    expect(up).toHaveClass("book-order-move");
    expect(up).not.toHaveClass("btn");
    expect(up).toBeDisabled();
    expect(down).toHaveAttribute("data-variant", "secondary");
    expect(down).toHaveClass("book-order-move");
    expect(down).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Pie down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Soup up" })).toBeEnabled();

    const save = screen.getByRole("button", { name: "Save book" });
    expect(save).toHaveAttribute("data-slot", "button");
    expect(save).toHaveAttribute("data-variant", "default");
    expect(save).toHaveAttribute("data-size", "md");
    expect(save).toHaveAttribute("type", "submit");
    expect(save).not.toHaveClass("btn");

    await act(async () => {
      fireEvent.click(save);
    });
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toBeDisabled();
    expect(save.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(save).toHaveTextContent("Save book");
    expect(save).not.toHaveTextContent("Saving");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finish({});
    });
    expect(onClose).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("saves dedication, cover, cards, and order, then refreshes the reader", async () => {
    vi.mocked(api).mockResolvedValueOnce({});
    const onClose = vi.fn();
    render(
      <BookSettingsSheet
        bookId={BOOK}
        name="Household 1 kitchen"
        settings={{ title: "Our book" }}
        recipes={RECIPES}
        open
        onClose={onClose}
      />
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Our book");
    // Photo-less recipes are not cover choices.
    expect(screen.queryByRole("radio", { name: "Soup" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Dedication"), {
      target: { value: "For Mom, Christmas 2026" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Pie" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /include original cards/i }));
    fireEvent.click(screen.getByRole("button", { name: "Move Pie up" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save book" }));
    });

    expect(api).toHaveBeenCalledWith(`/api/v1/cookbooks/${BOOK}`, {
      method: "PATCH",
      body: JSON.stringify({
        bookSettings: {
          cover: { kind: "recipe", recipeId: C },
          title: "Our book",
          subtitle: "",
          dedication: "For Mom, Christmas 2026",
          includeCards: false,
        },
        recipeOrder: [A, C, B],
      }),
    });
    expect(onClose).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the sheet open and says why when the save fails", async () => {
    vi.mocked(api).mockRejectedValueOnce(new Error("Cover recipe is not in this cookbook."));
    const onClose = vi.fn();
    render(
      <BookSettingsSheet
        bookId={BOOK}
        name="Household 1 kitchen"
        settings={{}}
        recipes={RECIPES}
        open
        onClose={onClose}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save book" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("not in this cookbook");
    expect(onClose).not.toHaveBeenCalled();
    // Unchanged order is not sent.
    expect(JSON.parse((vi.mocked(api).mock.calls[0]![1] as any).body).recipeOrder).toBeUndefined();
  });
});
