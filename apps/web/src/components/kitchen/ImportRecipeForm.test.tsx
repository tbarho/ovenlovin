import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { BLOCKED_IMPORT_COPY, NOT_A_RECIPE_COPY, PAGE_GONE_COPY } from "@/lib/import-input";
import {
  PHOTO_IMPORT_ESTIMATE,
  PHOTO_IMPORT_MAX_PAGES,
  PHOTO_IMPORT_TIMEOUT_MESSAGE,
  PHOTO_PICK_LEAD,
  PHOTO_SAVE_NO_IMAGE_MESSAGE,
} from "@/lib/photo-import-client";
import { cancelPhotoImportJob } from "@/lib/photo-import-job";
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

function mockXhr(options?: { hang?: boolean; status?: number; body?: unknown; timeout?: boolean }) {
  const xhr = {
    upload: {
      onprogress: null as ((event: ProgressEvent) => void) | null,
      onload: null as (() => void) | null,
    },
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    ontimeout: null as (() => void) | null,
    onabort: null as (() => void) | null,
    status: options?.status ?? 200,
    responseText: JSON.stringify(options?.body ?? preview),
    timeout: 0,
    withCredentials: false,
    open: vi.fn(),
    send: vi.fn(function (this: typeof xhr) {
      if (options?.hang) return;
      if (options?.timeout) {
        this.ontimeout?.();
        return;
      }
      this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 } as ProgressEvent);
      this.upload.onload?.();
      this.onload?.();
    }),
    abort: vi.fn(function (this: typeof xhr) {
      this.onabort?.();
    }),
  };
  vi.stubGlobal(
    "XMLHttpRequest",
    vi.fn(() => xhr)
  );
  return xhr;
}

describe("ImportRecipeForm photo import", () => {
  beforeEach(() => {
    mockXhr();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:preview"),
        revokeObjectURL: vi.fn(),
      })
    );
    vi.mocked(api).mockReset();
  });

  afterEach(() => {
    cancelPhotoImportJob();
    window.sessionStorage.removeItem("ovenlovin.import-toast");
    vi.unstubAllGlobals();
  });

  it("shows Import from photo next to URL and Paste", () => {
    render(<ImportRecipeForm />);
    expect(screen.getByRole("tab", { name: "Link" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cookbook" })).toBeVisible();
  });

  it("reads a photo after Import recipe", async () => {
    const xhr = mockXhr({ hang: true });
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    expect(screen.queryByRole("button", { name: "Read recipe" })).not.toBeInTheDocument();
    expect(await screen.findByText("Uploading 0%")).toBeVisible();
    expect(screen.getByText(`${PHOTO_IMPORT_ESTIMATE}.`)).toBeVisible();
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Selected recipe photo" })).toHaveAttribute(
      "src",
      "blob:preview"
    );
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 32, total: 100 } as ProgressEvent);
    expect(await screen.findByText("Uploading 32%")).toBeVisible();
    xhr.upload.onload?.();
    const meter = await screen.findByRole("progressbar", { name: "Reading" });
    expect(meter).toHaveClass("is-indeterminate");
    expect(meter).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByText("Reading - 0:00")).toBeVisible();
    expect(screen.getByText("Uploading 100%").closest("li")).toHaveClass("is-done");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      `Upload done. Reading 1 page. ${PHOTO_IMPORT_ESTIMATE}.`
    );
    xhr.onload?.();
    await waitFor(() => expect(screen.getByLabelText("Title")).toBeVisible());
    expect(within(dialog).getByRole("status")).toHaveTextContent(/Ready to review/);
  });

  it("opens a review dialog after reading a photo, with a low-confidence warning", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    expect(screen.queryByRole("button", { name: "Read recipe" })).not.toBeInTheDocument();
    expect(screen.getByText(/Drop a recipe card/i)).toBeVisible();
    expect(screen.getByText("Take photo")).toBeVisible();
    expect(screen.getByText("Choose photos")).toBeVisible();

    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const inputs = document.querySelectorAll('input[type="file"]');
    const library = inputs[1] as HTMLInputElement;
    await user.upload(library, file);
    expect(document.querySelector('.photo-pages img[src="blob:preview"]')).toBeTruthy();
    expect(screen.getByText("Page 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Import recipe" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Import from photo");
    await waitFor(() => expect(within(dialog).getByLabelText("Title")).toBeVisible());
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Ready to review. This photo was hard to read. Check title, ingredient: pasta."
    );
    expect(within(dialog).getByLabelText("Title").closest("label")).toHaveClass("is-uncertain");
    expect(within(dialog).getByText("This title was hard to read.")).toBeVisible();
    expect(within(dialog).getByText("pasta was hard to read.")).toBeVisible();
    await typeFullWordAndKeepFocus(user, within(dialog).getByLabelText("Title"), "Garlic");
  });

  it("shows a timeout error with Retry, Cancel, and type or paste", async () => {
    mockXhr({ timeout: true });
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    expect(await screen.findByText(PHOTO_IMPORT_TIMEOUT_MESSAGE)).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Type or paste instead" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Cancel" }).length).toBeGreaterThan(0);
    const xhr = mockXhr();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(xhr.send).toHaveBeenCalled();
  });

  it("keeps the job running when Close is used and shows Import in progress", async () => {
    mockXhr({ hang: true });
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Import in progress")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  it("keeps Import in progress after switching to the URL tab", async () => {
    mockXhr({ hang: true });
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img", { name: /selected recipe photo/i })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("tab", { name: "Link" }));
    expect(screen.getByTestId("photo-import-progress")).toBeVisible();
    expect(screen.getByText("Import in progress")).toBeVisible();
    expect(screen.getByRole("img", { name: /selected recipe photo/i })).toBeVisible();
  });

  it("shows Saving this recipe after Save and stores the import toast", async () => {
    const user = userEvent.setup();
    let finishSave: (value: { id: string; title: string; servings: number }) => void = () => {};
    vi.mocked(api).mockImplementation((path: string) => {
      if (path === "/api/v1/recipes") {
        return new Promise((resolve) => {
          finishSave = resolve;
        });
      }
      return Promise.resolve({ id: "rec-1", images: ["/api/v1/recipes/rec-1/image"] });
    });
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Title")).toBeVisible());
    await user.click(within(dialog).getByRole("button", { name: "Save recipe" }));
    expect(within(dialog).getByText("Saving this recipe…")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
    finishSave({ id: "rec-1", title: "Weeknight Tomato Pasta", servings: 4 });
    await waitFor(() =>
      expect(JSON.parse(window.sessionStorage.getItem("ovenlovin.import-toast") ?? "null")).toEqual(
        {
          title: "Weeknight Tomato Pasta",
          servings: 4,
        }
      )
    );
  });

  it("saves the recipe first, then POSTs a compressed photo separately", async () => {
    mockXhr({ body: { ...preview, images: [] } });
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === "/api/v1/recipes") return { id: "rec-1", title: "Weeknight Tomato Pasta" };
      return { id: "rec-1", images: ["/api/v1/recipes/rec-1/image"] };
    });
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Title")).toBeVisible());
    await user.click(within(dialog).getByRole("button", { name: "Save recipe" }));
    await waitFor(() => expect(api).toHaveBeenCalled());
    const createCall = vi.mocked(api).mock.calls.find((call) => call[0] === "/api/v1/recipes");
    expect(createCall).toBeTruthy();
    const created = JSON.parse(String(createCall?.[1]?.body));
    expect(created.images).toEqual([]);
    expect(JSON.stringify(created)).not.toContain("data:image");
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/api/v1/recipes/rec-1/image",
        expect.objectContaining({ method: "POST" })
      )
    );
    const imageCall = vi
      .mocked(api)
      .mock.calls.find((call) => call[0] === "/api/v1/recipes/rec-1/image");
    const imageBody = JSON.parse(String(imageCall?.[1]?.body));
    expect(imageBody.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(imageBody.image.length).toBeLessThan(50_000);
  });

  it("numbers pages, reorders them, and imports them in order", async () => {
    const xhr = mockXhr({ hang: true });
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    expect(screen.getByText(PHOTO_PICK_LEAD)).toBeVisible();
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    const pages = ["one.jpg", "two.jpg", "three.jpg"].map(
      (name) => new File([name], name, { type: "image/jpeg" })
    );
    await user.upload(library, pages.slice(0, 2));
    expect(screen.getByText("Pages 1 to 2 added.")).toBeInTheDocument();
    const camera = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    await user.upload(camera, pages[2]!);
    expect(screen.getByText("Page 3 added.")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeVisible();
    expect(screen.getByText("Add page")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Move page 3 earlier" }));
    expect(screen.getByText("Page 3 moved to 2.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove page 1" }));
    expect(screen.getByText("Page 1 removed.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import 2 pages" }));
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());
    const sent = ((xhr.send.mock.calls as any[])[0]?.[0] as FormData).getAll("image") as File[];
    expect(sent.map((file) => file.name)).toEqual(["three.jpg", "two.jpg"]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("img", { name: /Recipe page/ })).toHaveLength(2);
  });

  it("caps pages at the limit and disables Add page", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    const files = Array.from(
      { length: PHOTO_IMPORT_MAX_PAGES + 1 },
      (_, index) => new File([`p${index}`], `p${index}.jpg`, { type: "image/jpeg" })
    );
    await user.upload(library, files);
    expect(screen.getByText(`Page ${PHOTO_IMPORT_MAX_PAGES}`)).toBeVisible();
    expect(screen.queryByText(`Page ${PHOTO_IMPORT_MAX_PAGES + 1}`)).not.toBeInTheDocument();
    expect(screen.queryByText("Add page")).not.toBeInTheDocument();
    expect(screen.getByText("Up to 6 pages")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Pages 1 to 6 added. Up to 6 pages.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Import ${PHOTO_IMPORT_MAX_PAGES} pages` })
    ).toBeEnabled();
  });

  it("says the recipe saved when the photo upload fails", async () => {
    mockXhr({ body: { ...preview, images: [] } });
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === "/api/v1/recipes") return { id: "rec-1", title: "Weeknight Tomato Pasta" };
      throw new TypeError("Failed to fetch");
    });
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("tab", { name: "Photo" }));
    const file = new File(["card"], "card.jpg", { type: "image/jpeg" });
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await user.upload(library, file);
    await user.click(screen.getByRole("button", { name: "Import recipe" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Title")).toBeVisible());
    await user.click(within(dialog).getByRole("button", { name: "Save recipe" }));
    expect(await within(dialog).findByText(PHOTO_SAVE_NO_IMAGE_MESSAGE)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Open recipe" })).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Save recipe" })).not.toBeInTheDocument();
  });
});

describe("ImportRecipeForm url and paste validation", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("shows remaining demo imports up front", () => {
    render(<ImportRecipeForm remainingImports={3} importLimit={5} />);
    expect(screen.getByTestId("import-quota")).toHaveTextContent("3 of 5 left");
  });

  it.each(["url", "paste"] as const)(
    "reuses photo stages, estimate, and Cancel while a %s import is in flight",
    async (tab) => {
      const user = userEvent.setup();
      let signal: AbortSignal | undefined;
      vi.mocked(api).mockImplementation(
        (_path, init) =>
          new Promise((_, reject) => {
            signal = init?.signal ?? undefined;
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            });
          })
      );
      render(<ImportRecipeForm />);
      if (tab === "paste") {
        await user.click(screen.getByRole("button", { name: "Paste the recipe text" }));
        await user.type(screen.getByPlaceholderText(/weeknight tomato pasta/i), "Parent A pasta");
      } else {
        await user.type(
          screen.getByPlaceholderText(/instagram.com\/reel/i),
          "https://www.allrecipes.com/cookies"
        );
      }
      await user.click(screen.getByRole("button", { name: "Import" }));
      expect(await screen.findByTestId("import-progress")).toBeVisible();
      expect(screen.getByRole("heading", { name: "Importing" })).toBeVisible();
      expect(
        screen.getByText(tab === "paste" ? "Reading the recipe" : "Finding the page")
      ).toBeVisible();
      const meter = screen.getByRole("progressbar", { name: "Importing" });
      expect(meter).toHaveAttribute("aria-valuetext", "Working, no estimate");
      expect(meter).not.toHaveAttribute("aria-valuenow");
      expect(screen.queryByText("Importing…")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(signal?.aborted).toBe(true);
      expect(await screen.findByRole("button", { name: "Import" })).toBeVisible();
      expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  );

  it("keeps Paste import disabled until there is text", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("button", { name: "Paste the recipe text" }));
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
    await user.type(screen.getByPlaceholderText(/instagram.com\/reel/i), "not a url");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(
      screen.getByText(
        "That does not look like a link. It should start with https://www.instagram.com/"
      )
    ).toBeVisible();
    expect(api).not.toHaveBeenCalled();
    await user.clear(screen.getByPlaceholderText(/instagram.com\/reel/i));
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.allrecipes.com/x"
    );
    expect(
      screen.queryByText(
        "That does not look like a link. It should start with https://www.instagram.com/"
      )
    ).not.toBeInTheDocument();
  });

  it("does not report example.com as blocked", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://example.com/chocolate-chip-cookies"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByText(NOT_A_RECIPE_COPY)).toBeVisible();
    expect(document.querySelector(".import-error")?.textContent).not.toMatch(/blocked/i);
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Paste the recipe text" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add a photo" })).toBeVisible();
  });

  it("treats a paste schema-miss as not a recipe, not busy", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("We couldn't find a recipe in that text/photo"));
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("button", { name: "Paste the recipe text" }));
    await user.type(screen.getByPlaceholderText(/weeknight tomato pasta/i), "lorem ipsum");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText(NOT_A_RECIPE_COPY)).toBeVisible();
    expect(screen.queryByText(/busy right now/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add a photo" })).toBeVisible();
  });

  it("names a gone page and an unsupported site", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("That page is gone."));
    render(<ImportRecipeForm />);
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.foodnetwork.com/recipes/old"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText(PAGE_GONE_COPY)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paste the recipe text" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add a photo" })).toBeVisible();
  });

  it("does not show Try again on an unexpected paste failure", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValue(new Error("An unexpected error occurred"));
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("button", { name: "Paste the recipe text" }));
    await user.type(screen.getByPlaceholderText(/weeknight tomato pasta/i), "Soup\nServes 2");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText("An unexpected error occurred")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a photo" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Paste the recipe text" })).not.toBeInTheDocument();
  });

  it("offers paste and photo when a site blocks the URL importer", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValue(
      new Error("This site blocked the importer (tried direct, google-translate, jina).")
    );
    render(<ImportRecipeForm />);
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.budgetbytes.com/beef-stroganoff/"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText(BLOCKED_IMPORT_COPY)).toBeVisible();
    expect(screen.getByText(BLOCKED_IMPORT_COPY)).not.toHaveTextContent(/bookmarklet/i);
    const pasteHelp = screen.getByRole("button", { name: "Paste the recipe text" });
    const photoHelp = screen.getByRole("button", { name: "Add a photo" });
    expect(pasteHelp.compareDocumentPosition(photoHelp) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    await user.click(pasteHelp);
    expect(screen.getByPlaceholderText(/weeknight tomato pasta/i)).toHaveFocus();
    expect(screen.queryByText(BLOCKED_IMPORT_COPY)).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Link" }));
    expect(screen.getByPlaceholderText(/instagram.com\/reel/i)).toHaveValue(
      "https://www.budgetbytes.com/beef-stroganoff/"
    );
  });

  it("keeps the typed URL when Add a photo is used after a block", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValue(new Error("This site blocked the importer (tried direct)."));
    render(<ImportRecipeForm />);
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(await screen.findByRole("button", { name: "Add a photo" }));
    expect(screen.getByRole("tab", { name: "Photo" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Link" }));
    expect(screen.getByPlaceholderText(/instagram.com\/reel/i)).toHaveValue(
      "https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524"
    );
  });

  it("does not reuse an Idempotency-Key after the URL changes", async () => {
    const user = userEvent.setup();
    let n = 0;
    vi.stubGlobal("crypto", {
      ...crypto,
      randomUUID: () => `import-key-${++n}`,
    });
    const urlPreview = {
      title: "Cookies",
      servings: 4,
      ingredients: [{ rawText: "flour" }],
      steps: [{ text: "Mix." }],
      source: {
        type: "url",
        importerName: "url-importer",
        importerVersion: "0.1.0",
        rawExtractionJson: {},
      },
    };
    vi.mocked(api)
      .mockResolvedValueOnce(urlPreview)
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(urlPreview)
      .mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000088",
        title: "Cookies",
        servings: 4,
      });
    render(<ImportRecipeForm />);
    const field = screen.getByPlaceholderText(/instagram.com\/reel/i);
    await user.type(field, "https://www.budgetbytes.com/pasta");
    await user.click(screen.getByRole("button", { name: "Import" }));
    const firstDialog = await screen.findByRole("dialog");
    await user.click(within(firstDialog).getByRole("button", { name: "Save to kitchen" }));
    expect(await within(firstDialog).findByText("Connection lost")).toBeVisible();
    await user.clear(field);
    await user.type(field, "https://www.budgetbytes.com/cookies");
    await user.click(screen.getByRole("button", { name: "Import" }));
    const secondDialog = await screen.findByRole("dialog");
    await user.click(within(secondDialog).getByRole("button", { name: "Save to kitchen" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(4));
    const keys = vi.mocked(api).mock.calls.map((call) => {
      const headers = call[1]?.headers as Record<string, string> | undefined;
      return headers?.["Idempotency-Key"];
    });
    expect(keys[0]).toBeUndefined();
    expect(keys[1]).toBe("import-key-1");
    expect(keys[2]).toBeUndefined();
    expect(keys[3]).toBe("import-key-2");
    vi.unstubAllGlobals();
  });

  it("shows guessed servings after a paste import is reviewed and saved", async () => {
    const user = userEvent.setup();
    vi.mocked(api)
      .mockResolvedValueOnce({
        title: "Test Recipe 1",
        servings: 4,
        ingredients: [{ rawText: "pasta" }],
        steps: [{ text: "Boil." }],
        source: {
          type: "paste",
          importerName: "paste-importer",
          importerVersion: "0.1.0",
          rawExtractionJson: {},
        },
      })
      .mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000099",
        title: "Test Recipe 1",
        servings: 4,
      });
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("button", { name: "Paste the recipe text" }));
    await user.type(screen.getByPlaceholderText(/weeknight tomato pasta/i), "Test Recipe 1");
    await user.click(screen.getByRole("button", { name: "Import" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Test Recipe 1");
    await user.click(within(dialog).getByRole("button", { name: "Save to kitchen" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api).mock.calls[1]?.[1]?.body).toContain("save");
    expect(await screen.findByTestId("import-review")).toHaveTextContent(
      "Imported Test Recipe 1 · 4 servings (guessed)"
    );
  });
});

const reel = "https://www.instagram.com/reel/C9mIsoButter?igsh=abc";

const captionPreview = {
  title: "15-minute miso butter pasta",
  servings: 2,
  ingredients: [{ rawText: "8 oz spaghetti" }, { rawText: "a splash of soy sauce" }],
  steps: [{ text: "Boil the pasta." }, { text: "Toss with miso." }],
  images: [],
  source: {
    type: "social",
    author: "@weeknightwithmaya",
    url: "https://www.instagram.com/reel/C9mIsoButter",
    canonicalUrl: "https://www.instagram.com/reel/C9mIsoButter",
    importerName: "instagram",
    importerVersion: "0.1.0",
    rawExtractionJson: {
      sourcePlatform: "instagram",
      sourceName: "@weeknightwithmaya",
      kind: "reel",
      caption: "15-minute miso butter pasta\n8 oz spaghetti\na splash of soy sauce",
      coverStorable: false,
    },
  },
};

describe("ImportRecipeForm Instagram", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for a link, and rejects text that is not a link", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByText("Paste an Instagram link first.")).toBeVisible();
    expect(api).not.toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText(/instagram.com\/reel/i), "not a url");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(
      screen.getByText(
        "That does not look like a link. It should start with https://www.instagram.com/"
      )
    ).toBeVisible();
  });

  it("says plainly it cannot read Instagram links and goes straight to the caption paste", async () => {
    const user = userEvent.setup();
    render(<ImportRecipeForm />);
    const field = screen.getByPlaceholderText(/instagram.com\/reel/i);
    await user.type(field, reel);
    expect(
      screen.getByText(/Instagram Reel link\. We can't read Instagram links yet\./)
    ).toBeVisible();
    await user.clear(field);
    await user.type(field, "https://instagram.com/p/C8sheetPanGn/");
    expect(
      screen.getByText(/Instagram post link\. We can't read Instagram links yet\./)
    ).toBeVisible();
    expect(screen.queryByText(/We read the caption/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Paste the caption" }));
    expect(await screen.findByRole("heading", { name: "Paste the caption" })).toBeVisible();
    expect(screen.getByLabelText("Caption")).toHaveFocus();
    expect(screen.queryByTestId("import-progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Finding the post")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("reads a pasted caption, credits the creator, and saves to the kitchen", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValueOnce(captionPreview).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-0000000000aa",
      title: "15-minute miso butter pasta",
      servings: 2,
    });
    render(<ImportRecipeForm cookbooks={[{ id: "book-1", name: "Weeknight dinners" }]} />);
    await user.type(screen.getByPlaceholderText(/instagram.com\/reel/i), reel);
    await user.click(screen.getByRole("button", { name: "Paste the caption" }));
    await user.click(screen.getByRole("button", { name: "Read caption" }));
    expect(await screen.findByText("Paste the caption first.")).toBeVisible();
    await user.type(screen.getByLabelText("Caption"), "15-minute miso butter pasta");
    await user.click(screen.getByRole("button", { name: "Read caption" }));
    expect(
      await screen.findByRole("link", { name: "From @weeknightwithmaya on Instagram" })
    ).toBeVisible();
    expect(screen.queryByText("Paste the caption first.")).not.toBeInTheDocument();
    expect(screen.getByText("No amount in the caption. Add one if you know it.")).toBeVisible();
    expect(screen.queryByText("No cover photo. You can add one later.")).not.toBeInTheDocument();
    expect(screen.getByText(/Show the caption we read/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save to kitchen" }));
    expect(await screen.findByRole("heading", { name: "Saved to your kitchen" })).toBeVisible();
    expect(screen.getByText("From @weeknightwithmaya on Instagram")).toBeVisible();
    expect(screen.getByText("Serves 2 · 2 ingredients")).toBeVisible();
    const readCall = vi.mocked(api).mock.calls[0];
    expect(String(readCall?.[1]?.body)).toContain(
      '"sourceUrl":"https://www.instagram.com/reel/C9mIsoButter"'
    );
    const saveCall = vi.mocked(api).mock.calls[1];
    expect(saveCall?.[0]).toBe("/api/v1/recipes/import");
    expect(String(saveCall?.[1]?.body)).toContain('"sourcePlatform":"instagram"');
    expect(String(saveCall?.[1]?.body)).toContain("no-amount:a splash of soy sauce");
  });

  it("leaves the import flow from Back to recipes with the saved recipe id", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    vi.mocked(api).mockResolvedValueOnce(captionPreview).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-0000000000aa",
      title: "15-minute miso butter pasta",
      servings: 2,
    });
    render(<ImportRecipeForm onDone={onDone} />);
    await user.type(screen.getByPlaceholderText(/instagram.com\/reel/i), reel);
    await user.click(screen.getByRole("button", { name: "Paste the caption" }));
    await user.type(screen.getByLabelText("Caption"), "15-minute miso butter pasta");
    await user.click(screen.getByRole("button", { name: "Read caption" }));
    await user.click(await screen.findByRole("button", { name: "Save to kitchen" }));
    await screen.findByRole("heading", { name: "Saved to your kitchen" });
    expect(screen.queryByRole("link", { name: "Back to recipes" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to recipes" }));
    expect(onDone).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000aa");
    expect(
      screen.queryByRole("heading", { name: "Saved to your kitchen" })
    ).not.toBeInTheDocument();
  });

  it("cancels an in-flight import without saving", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(api).mockImplementation(
      (_path, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    render(<ImportRecipeForm />);
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.budgetbytes.com/pasta"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Import cancelled. Nothing saved.")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.getByText("Import cancelled. Nothing saved.")).toBeVisible();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByText("Import cancelled. Nothing saved.")).not.toBeInTheDocument();
  });
});
