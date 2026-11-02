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
