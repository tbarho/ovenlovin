import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { BOOK_NOT_PDF } from "@/lib/book-import-client";
import { BookImportDoor } from "./BookImportDoor";
import { ImportRecipeForm } from "./ImportRecipeForm";

const MB = 1024 * 1024;
const SHA = "f".repeat(64);
const hash = async () => SHA;

function bookFile(name = "Salt Fat Acid Heat.pdf", type = "application/pdf") {
  const file = new File(["%PDF-1.4"], name, { type });
  Object.defineProperty(file, "size", { value: 48 * MB });
  return file;
}

async function openAndPick(file: File) {
  await userEvent.click(screen.getByRole("button", { name: "Add a whole cookbook" }));
  await userEvent.upload(screen.getByLabelText("Cookbook PDF"), file, { applyAccept: false });
}

describe("BookImportDoor", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("shows the door only when books are enabled", async () => {
    const { unmount } = render(<ImportRecipeForm />);
    expect(screen.queryByRole("button", { name: "Add a whole cookbook" })).not.toBeInTheDocument();
    unmount();

    render(<ImportRecipeForm booksEnabled />);
    expect(screen.queryByRole("button", { name: "Add a whole cookbook" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Cookbook" }));
    expect(screen.getByRole("button", { name: "Add a whole cookbook" })).toBeVisible();
  });

  it("uploads straight to Blob with byte progress, then creates the job", async () => {
    let progress: (event: { loaded: number; total: number }) => void = () => {};
    let finish: (blob: { url: string }) => void = () => {};
    const upload = vi.fn(
      (_path: string, _file: File, options: any) =>
        new Promise((resolve) => {
          progress = options.onUploadProgress;
          finish = resolve;
        })
    );
    vi.mocked(api).mockImplementation(async (_path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.blobUrl) return { status: "upload", pathname: `books/h/${SHA}.pdf` };
      return { status: "started", jobId: "job-1" };
    });

    render(<BookImportDoor deps={{ upload, hash }} />);
    await openAndPick(bookFile());

    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(upload.mock.calls[0]![0]).toBe(`books/h/${SHA}.pdf`);
    expect(upload.mock.calls[0]![2]).toMatchObject({
      access: "public",
      handleUploadUrl: "/api/v1/books/upload",
      multipart: true,
    });

    progress({ loaded: 12 * MB, total: 48 * MB });
    expect(await screen.findByText("Uploading 12.0 MB of 48.0 MB")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Upload" })).toHaveAttribute(
      "aria-valuenow",
      "25"
    );

    finish({ url: "https://abc.public.blob.vercel-storage.com/books/h/x.pdf" });
    expect(
      await screen.findByText("Got it. We're checking the file now. Next we'll read the contents.")
    ).toBeVisible();
    expect(vi.mocked(api).mock.calls[1]![1]!.body).toContain('"blobUrl"');
  });

  it("resumes a book it already has without uploading again", async () => {
    const upload = vi.fn();
    vi.mocked(api).mockResolvedValue({ status: "resumed", jobId: "job-1", pages: 312 });

    render(<BookImportDoor deps={{ upload, hash }} />);
    await openAndPick(bookFile());

    expect(
      await screen.findByText("You already added this book. We'll pick up where it left off.")
    ).toBeVisible();
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows the plain refusal when the book is over a limit", async () => {
    const upload = vi.fn();
    vi.mocked(api).mockRejectedValue(
      new Error("This file is bigger than 500 MB. Try a smaller copy of the book.")
    );

    render(<BookImportDoor deps={{ upload, hash }} />);
    await openAndPick(bookFile());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This file is bigger than 500 MB. Try a smaller copy of the book."
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("turns away an ebook at the door", async () => {
    render(<BookImportDoor deps={{ upload: vi.fn(), hash }} />);
    await openAndPick(bookFile("Book.epub", "application/epub+zip"));

    expect(await screen.findByRole("alert")).toHaveTextContent(BOOK_NOT_PDF);
    expect(api).not.toHaveBeenCalled();
  });
});
