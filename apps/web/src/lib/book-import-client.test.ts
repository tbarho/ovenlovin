import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { addBook } from "@/lib/book-import-client";

const SHA = "f".repeat(64);
const hash = async () => SHA;
const book = () => new File(["%PDF-1.4"], "Book.pdf", { type: "application/pdf" });

describe("addBook upload access", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it.each([
    [undefined, "public"],
    ["public", "public"],
    ["private", "private"],
  ])("preflight access %s uploads %s", async (access, expected) => {
    vi.mocked(api).mockImplementation(async (_path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.blobUrl) return { status: "upload", pathname: `books/h/${SHA}.pdf`, access };
      return { status: "started", jobId: "job-1" };
    });
    const upload = vi.fn(async () => ({ url: "https://store/books/h/x.pdf" }));
    await addBook(book(), () => undefined, { upload, hash });
    expect((upload.mock.calls[0] as any[])[2]).toMatchObject({ access: expected });
  });
});
