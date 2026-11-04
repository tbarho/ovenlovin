import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_IMPORT_MAX_PAGES, PHOTO_PICK_LEAD } from "@/lib/photo-import-client";
import { PhotoPick } from "./PhotoPick";

function PhotoPickHarness() {
  const [files, setFiles] = useState<File[]>([]);
  return <PhotoPick files={files} onChange={setFiles} />;
}

function imageFile(name: string) {
  return new File([name], name, { type: "image/jpeg" });
}

function labeledInput(name: string) {
  return screen.getByLabelText(name) as HTMLInputElement;
}

describe("PhotoPick", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps camera and library picks as secondary ds-button labels", () => {
    render(<PhotoPickHarness />);

    expect(screen.getByText(PHOTO_PICK_LEAD)).toBeVisible();

    const camera = labeledInput("Take photo");
    const library = labeledInput("Choose photos");
    expect(camera).toHaveAttribute("type", "file");
    expect(camera).toHaveAttribute("accept", "image/*");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).not.toHaveAttribute("multiple");
    expect(camera).toBeEnabled();
    expect(library).toHaveAttribute("type", "file");
    expect(library).toHaveAttribute("accept", "image/*");
    expect(library).toHaveAttribute("multiple");
    expect(library).not.toHaveAttribute("capture");
    expect(library).toBeEnabled();

    for (const input of [camera, library]) {
      expect(input.labels).toHaveLength(1);
      const label = input.labels?.[0];
      expect(label?.tagName).toBe("LABEL");
      expect(label).toHaveClass("ds-button", "ds-button--secondary", "ds-button--md");
      expect(label).not.toHaveClass("btn");
      expect(label).not.toHaveAttribute("data-slot");
      expect(label).not.toHaveAttribute("href");
    }

    expect(screen.queryByRole("button", { name: "Take photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose photos" })).not.toBeInTheDocument();
  });

  it("uses compact secondary Buttons to reorder, remove, and add pages", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:preview",
      revokeObjectURL: vi.fn(),
    });
    const user = userEvent.setup();
    render(<PhotoPickHarness />);

    await user.upload(labeledInput("Choose photos"), [imageFile("one.jpg"), imageFile("two.jpg")]);
    expect(screen.getByText("Pages 1 to 2 added.")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeVisible();
    expect(screen.getByText("Page 2")).toBeVisible();
    expect(screen.queryByText("Take photo")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose photos")).not.toBeInTheDocument();

    for (const name of [
      "Move page 2 earlier",
      "Move page 1 later",
      "Remove page 1",
      "Remove page 2",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("data-slot", "button");
      expect(button).toHaveAttribute("data-variant", "secondary");
      expect(button).toHaveAttribute("data-size", "sm");
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveClass("ds-button", "ds-button--secondary", "ds-button--sm");
      expect(button).not.toHaveClass("btn", "compact");
      expect(button).not.toHaveAttribute("href");
      expect(button.closest(".photo-page-actions")).not.toBeNull();
    }
    expect(screen.getByRole("button", { name: "Move page 1 earlier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move page 2 later" })).toBeDisabled();

    const add = screen.getByText("Add page");
    expect(add.tagName).toBe("LABEL");
    expect(add).toHaveClass("photo-page-add-target");
    expect(add).not.toHaveClass("ds-button", "btn");
    const camera = document.getElementById(add.getAttribute("for") ?? "") as HTMLInputElement;
    expect(camera).toHaveAttribute("type", "file");
    expect(camera).toHaveAttribute("capture", "environment");

    await user.upload(camera, imageFile("three.jpg"));
    expect(screen.getByText("Page 3 added.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move page 3 earlier" }));
    expect(screen.getByText("Page 3 moved to 2.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove page 1" }));
    expect(screen.getByText("Page 1 removed.")).toBeInTheDocument();
    expect(screen.getByText("Page 1")).toBeVisible();
    expect(screen.getByText("Page 2")).toBeVisible();
    expect(screen.queryByText("Page 3")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove page 2" }));
    expect(screen.getByText("Page 2 removed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move page/ })).not.toBeInTheDocument();
    const remove = screen.getByRole("button", { name: "Remove page 1" });
    expect(remove).toHaveClass("ds-button--secondary", "ds-button--sm");
    expect(remove).not.toHaveClass("btn", "compact");
  });

  it("ignores a non-image pick and caps pages at the limit", async () => {
    const user = userEvent.setup();
    render(<PhotoPickHarness />);

    await user.upload(labeledInput("Choose photos"), [
      new File(["notes"], "notes.txt", { type: "text/plain" }),
    ]);
    expect(screen.getByText("Take photo")).toBeVisible();
    expect(screen.queryByText("Page 1")).not.toBeInTheDocument();

    const files = Array.from({ length: PHOTO_IMPORT_MAX_PAGES + 1 }, (_, index) =>
      imageFile(`p${index}.jpg`)
    );
    await user.upload(labeledInput("Choose photos"), files);
    expect(screen.getByText(`Page ${PHOTO_IMPORT_MAX_PAGES}`)).toBeVisible();
    expect(screen.queryByText(`Page ${PHOTO_IMPORT_MAX_PAGES + 1}`)).not.toBeInTheDocument();
    expect(screen.queryByText("Add page")).not.toBeInTheDocument();
    expect(screen.getByText("Up to 6 pages")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Pages 1 to 6 added. Up to 6 pages.")).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(2);
    for (const input of document.querySelectorAll('input[type="file"]')) {
      expect(input).toBeDisabled();
    }
    expect(screen.getAllByRole("button", { name: /Remove page/ })).toHaveLength(
      PHOTO_IMPORT_MAX_PAGES
    );
  });
});
