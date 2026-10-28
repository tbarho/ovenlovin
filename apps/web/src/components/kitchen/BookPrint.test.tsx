import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/browser-api", () => ({ api: vi.fn() }));

import { api } from "@/lib/browser-api";
import { BookPrint, printProgressLabel } from "./BookPrint";

const BOOK = "00000000-0000-4000-8000-000000000020";

const view = (overrides: any = {}) => ({
  jobId: "job-1",
  mode: "shop",
  status: "running",
  done: 1,
  total: 4,
  pages: 120,
  bytes: null,
  lowRes: [],
  downloadUrl: null,
  error: null,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(api).mockReset();
});

describe("BookPrint", () => {
  it("starts the chosen mode, shows progress, then the download", async () => {
    vi.useFakeTimers();
    vi.mocked(api)
      .mockResolvedValueOnce(view())
      .mockResolvedValueOnce(
        view({
          status: "ready",
          done: 4,
          bytes: 3 * 1024 * 1024,
          downloadUrl: "/dl",
          lowRes: [{ page: 7, dpi: 140 }],
        })
      );
    render(<BookPrint bookId={BOOK} />);

    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    fireEvent.click(screen.getByRole("radio", { name: /at a print shop/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /make the pdf/i }));
    });

    expect(api).toHaveBeenCalledWith(`/api/v1/cookbooks/${BOOK}/pdf`, {
      method: "POST",
      body: JSON.stringify({ mode: "shop" }),
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(api).toHaveBeenLastCalledWith(`/api/v1/cookbooks/${BOOK}/pdf/job-1`);
    expect(screen.getByRole("link", { name: /download pdf 3.0 mb/i })).toHaveAttribute(
      "href",
      "/dl"
    );
    expect(screen.getByRole("note")).toHaveTextContent("1 photo prints below 300 dpi");
  });

  it("shows why it failed and lets you try again", async () => {
    vi.mocked(api).mockResolvedValueOnce(view({ status: "failed", error: "The book changed" }));
    render(<BookPrint bookId={BOOK} />);
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /make the pdf/i }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("The book changed");
    expect(screen.getByRole("button", { name: /make the pdf/i })).toBeEnabled();
  });

  it("labels progress in parts", () => {
    expect(printProgressLabel(view())).toBe("Making 120 pages · 1 of 4 parts done");
    expect(printProgressLabel(view({ status: "ready" }))).toBe("Ready. 120 pages.");
  });
});
