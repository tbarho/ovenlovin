import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, initialsFromName } from "./avatar";

describe("initialsFromName", () => {
  it("uses one or two uppercase letters", () => {
    expect(initialsFromName("Parent A")).toBe("PA");
    expect(initialsFromName("Sam")).toBe("SA");
    expect(initialsFromName("  child b  ")).toBe("CB");
    expect(initialsFromName("A")).toBe("A");
    expect(initialsFromName("")).toBe("");
  });
});

describe("Avatar", () => {
  it("falls back to letters and exposes an accessible name", () => {
    render(<Avatar name="Parent A" size={24} />);
    const avatar = screen.getByRole("img", { name: "Parent A" });
    expect(avatar).toHaveAttribute("data-size", "24");
    expect(avatar).toHaveClass("ds-avatar", "ds-avatar--24");
    expect(avatar).toHaveTextContent("PA");
    expect(avatar.querySelector("img")).toBeNull();
  });

  it("prefers src and treats the image as a placeholder until load", () => {
    render(<Avatar name="Sam" src="https://example.com/sam.png" alt="Sam portrait" />);
    const avatar = screen.getByRole("img", { name: "Sam portrait" });
    expect(avatar).toHaveAttribute("data-loading", "true");
    expect(avatar).toHaveTextContent("SA");

    const image = avatar.querySelector("img");
    expect(image).toHaveAttribute("src", "https://example.com/sam.png");
    expect(image).toHaveAttribute("alt", "");

    fireEvent.load(image!);
    expect(avatar).not.toHaveAttribute("data-loading");
    expect(image).toHaveAttribute("data-loaded", "true");
  });

  it("keeps letters when the image fails", () => {
    render(<Avatar name="Nana" src="https://example.com/missing.png" />);
    const avatar = screen.getByRole("img", { name: "Nana" });
    const image = avatar.querySelector("img");
    fireEvent.error(image!);
    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar).toHaveTextContent("NA");
  });
});
