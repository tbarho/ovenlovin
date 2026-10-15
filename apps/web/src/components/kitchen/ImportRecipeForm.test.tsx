import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { ImportRecipeForm } from "./ImportRecipeForm";

const preview = {
  title: "Weeknight Tomato Pasta",
  notes: "Salt the pasta water well.",
  servings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  ingredients: [{ rawText: "12 oz pasta" }],
  steps: [{ text: "Boil pasta." }],
  images: ["https://blob.example/main.jpg"],
  source: {
    type: "photo",
    attribution: "Weeknight Dinners, p. 42",
    importerName: "photo-importer",
    importerVersion: "0.1.0",
    rawExtractionJson: {},
  },
  overallConfidence: 0.4,
  needsReview: true,
  reviewReasons: [],
  uncertainFields: ["title", "ingredient: pasta"],
  allergenClassifications: [],
};

describe("ImportRecipeForm photo import", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => preview,
      })
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(api).mockReset();
  });

  it("shows Import from photo next to URL and Paste", () => {
    render(<ImportRecipeForm />);
    expect(screen.getByRole("tab", { name: "URL" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Paste" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
  });

  it("shows a progress state while the photo is being read", async () => {
    let resolveExtract:
      ((value: { ok: boolean; json: () => Promise<typeof preview> }) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExtract = resolve;
          })
      )
    );
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Read recipe" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Reading the recipe…");
    resolveExtract?.({ ok: true, json: async () => preview });
    await waitFor(() => expect(screen.getByLabelText("Title")).toBeVisible());
  });

  it("opens a review dialog after reading a photo, with a low-confidence warning", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    expect(screen.getByRole("button", { name: "Read recipe" })).toBeDisabled();
    expect(screen.getByText(/Drop a recipe card/i)).toBeVisible();
    expect(screen.getByText("Take photo")).toBeVisible();
    expect(screen.getByText("Choose photos")).toBeVisible();

    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const inputs = document.querySelectorAll('input[type="file"]');
    const library = inputs[1] as HTMLInputElement;
    await user.upload(library, file);
    expect(screen.getByRole("button", { name: "Read recipe" })).toBeEnabled();
    expect(document.querySelector('.photo-thumbs img[src="blob:preview"]')).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Read recipe" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Import from photo");
    await waitFor(() => expect(within(dialog).getByLabelText("Title")).toBeVisible());
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "This photo was hard to read. Check title, ingredient: pasta."
    );
    expect(fetch).toHaveBeenCalled();
    await typeFullWordAndKeepFocus(user, within(dialog).getByLabelText("Title"), "Garlic");
  });
});

describe("ImportRecipeForm url and paste validation", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("keeps Paste import disabled until there is text", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Paste" }));
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    await user.type(
      screen.getByPlaceholderText(/weeknight tomato pasta/i),
      "Parent A pasta{enter}{enter}Ingredients{enter}- pasta"
    );
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("validates a bad URL before calling the importer", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.type(screen.getByPlaceholderText(/example.com/i), "not a url");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByText("That doesn't look like a web address")).toBeVisible();
    expect(api).not.toHaveBeenCalled();
  });

  it("shows guessed servings after a paste import", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000099",
      title: "Test Recipe 1",
      servings: 4,
    });
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Paste" }));
    await user.type(screen.getByPlaceholderText(/weeknight tomato pasta/i), "Test Recipe 1");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByTestId("import-review")).toHaveTextContent(
      "Imported Test Recipe 1 · 4 servings (guessed)"
    );
  });
});
