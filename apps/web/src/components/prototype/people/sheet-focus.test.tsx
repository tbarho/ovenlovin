import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { PersonProfile } from "./PersonProfile";
import { PrototypeProvider } from "./store";

describe("prototype people sheets", () => {
  it("keeps focus while typing in the add-food sheet search", async () => {
    const user = userEvent.setup();
    render(
      <PrototypeProvider>
        <PersonProfile personId="jake" />
      </PrototypeProvider>
    );
    await user.click(screen.getByRole("button", { name: "Add something" }));
    await typeFullWordAndKeepFocus(
      user,
      screen.getByLabelText(/search foods or type a phrase/i),
      "garlic"
    );
  });
});
