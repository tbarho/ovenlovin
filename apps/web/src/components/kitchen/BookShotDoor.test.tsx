import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { BookShotDoor } from "./BookShotDoor";

describe("BookShotDoor primitives", () => {
  it("uses a secondary Button opener, Field + Input title, and default Read button", async () => {
    render(<BookShotDoor />);

    const opener = screen.getByRole("button", { name: "Add a paper cookbook" });
    expect(opener).toHaveAttribute("data-slot", "button");
    expect(opener).toHaveAttribute("data-variant", "secondary");

    await userEvent.click(opener);

    const title = screen.getByLabelText("Book title");
    expect(title).toHaveAttribute("data-slot", "input");
    expect(screen.getByText("Book title").closest("[data-slot='field']")).toHaveClass("ds-field");

    const read = screen.getByRole("button", { name: "Read the contents" });
    expect(read).toHaveAttribute("data-slot", "button");
    expect(read).toHaveAttribute("data-variant", "default");
    expect(read).toBeDisabled();
  });
});

describe("BookShotDoor", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:preview",
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads contents photos and keeps Pick recipes on a ds-button link", async () => {
    vi.mocked(api).mockResolvedValue({ jobId: "job-2" });

    render(<BookShotDoor defaultName="Household 1 Suppers.pdf" />);
    await userEvent.click(screen.getByRole("button", { name: "Add a paper cookbook" }));

    expect(screen.getByLabelText("Book title")).toHaveValue("Household 1 Suppers");
    const library = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    await userEvent.upload(library, new File(["page"], "contents.jpg", { type: "image/jpeg" }));
    await userEvent.click(screen.getByRole("button", { name: "Read the contents" }));

    expect(
      await screen.findByText("Got the contents. Pick the recipes you want from the book.")
    ).toBeVisible();
    const pick = screen.getByRole("link", { name: "Pick recipes" });
    expect(pick).toHaveAttribute("href", "/recipes/books/job-2");
    expect(pick).toHaveClass("ds-button", "ds-button--default", "ds-button--md");
    expect(pick).not.toHaveClass("btn");
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith(
        "/api/v1/books/photos",
        expect.objectContaining({ method: "POST" })
      );
    });
    const body = JSON.parse(String(vi.mocked(api).mock.calls[0]?.[1]?.body));
    expect(body.name).toBe("Household 1 Suppers");
    expect(body.images).toHaveLength(1);
    expect(body.images[0]).toMatch(/^data:/);
  });

  it("stays closed when blocked", async () => {
    const sentence = "Book uploads are turned off in the public demo.";
    render(
      <>
        <p id="books-blocked">{sentence}</p>
        <BookShotDoor blocked={sentence} />
      </>
    );
    const door = screen.getByRole("button", { name: "Add a paper cookbook" });
    expect(door).toBeDisabled();
    expect(door).toHaveAccessibleDescription(sentence);
    await userEvent.click(door);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
