import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CopyBox } from "./CopyBox";

describe("CopyBox", () => {
  it("shows a Copied state after a successful copy", async () => {
    const user = userEvent.setup();
    render(<CopyBox label="MCP URL" content="https://example.com/mcp" />);

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
  });

  it("masks a secret until Reveal is pressed", async () => {
    const user = userEvent.setup();
    render(<CopyBox label="Sandbox API key" content="olv_sandbox_key_abcd" secret />);

    expect(screen.getByText("olv_••••••••••••abcd")).toBeVisible();
    expect(screen.queryByText("olv_sandbox_key_abcd")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reveal" }));
    expect(screen.getByText("olv_sandbox_key_abcd")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.getByText("olv_••••••••••••abcd")).toBeVisible();
  });
});
