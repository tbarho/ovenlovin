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

describe("BookPrint primitives", () => {
  it("uses secondary Print / Make another Buttons, a default Make the PDF Button, and a ds-button download link", async () => {
    vi.mocked(api).mockResolvedValueOnce(
      view({
        status: "ready",
        done: 4,
        bytes: 3 * 1024 * 1024,
        downloadUrl: "/dl",
      })
    );
    render(<BookPrint bookId={BOOK} />);

    const print = screen.getByRole("button", { name: "Print" });
    expect(print).toHaveAttribute("data-slot", "button");
    expect(print).toHaveAttribute("data-variant", "secondary");
    expect(print).not.toHaveClass("btn");
    fireEvent.click(print);

    const make = screen.getByRole("button", { name: "Make the PDF" });
    expect(make).toHaveAttribute("data-slot", "button");
    expect(make).toHaveAttribute("data-variant", "default");
    expect(make).not.toHaveClass("btn");
    expect(screen.getByRole("radiogroup", { name: "Where to print" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /at home/i })).toHaveClass("choice");

    await act(async () => {
      fireEvent.click(make);
    });

    const download = screen.getByRole("link", { name: /download pdf 3.0 mb/i });
    expect(download).toHaveAttribute("href", "/dl");
    expect(download).toHaveAttribute("download");
    expect(download).toHaveClass("ds-button", "ds-button--default", "ds-button--md");
    expect(download).not.toHaveClass("btn");

    const again = screen.getByRole("button", { name: "Make another" });
    expect(again).toHaveAttribute("data-slot", "button");
    expect(again).toHaveAttribute("data-variant", "secondary");
    expect(again).not.toHaveClass("btn");

    expect(document.querySelector(".btn")).toBeNull();
  });
});

describe("BookPrint", () => {
  it("in the demo, Make the PDF is off up front and says why", () => {
    render(<BookPrint bookId={BOOK} blocked="Print PDFs are turned off in the public demo." />);
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    const make = screen.getByRole("button", { name: /make the pdf/i });
    expect(make).toBeDisabled();
    expect(make).toHaveAccessibleDescription("Print PDFs are turned off in the public demo.");
    fireEvent.click(make);
    expect(api).not.toHaveBeenCalled();
  });

  it("shows Make the PDF as a loading Button while the job starts", async () => {
    let resolveStart: (value: ReturnType<typeof view>) => void = () => {};
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        })
    );
    render(<BookPrint bookId={BOOK} />);
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    const make = screen.getByRole("button", { name: /make the pdf/i });
    fireEvent.click(make);

    expect(make).toHaveAttribute("aria-busy", "true");
    expect(make.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(make).toHaveTextContent("Make the PDF");

    await act(async () => {
      resolveStart(view());
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

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
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The book changed");
    expect(alert).toHaveAttribute("data-slot", "hint");
    expect(alert).toHaveClass("ds-hint--error");
    expect(screen.getByRole("button", { name: /make the pdf/i })).toBeEnabled();
  });

  it("labels progress in parts", () => {
    expect(printProgressLabel(view())).toBe("Making 120 pages · 1 of 4 parts done");
    expect(printProgressLabel(view({ status: "ready" }))).toBe("Ready. 120 pages.");
  });
});
