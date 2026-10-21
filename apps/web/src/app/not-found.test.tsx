import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => auth(...args),
}));

import NotFound from "./not-found";

describe("root not-found", () => {
  beforeEach(() => {
    auth.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test");
  });

  it("shows Open kitchen when Clerk auth has a userId", async () => {
    auth.mockResolvedValue({ userId: "user_1" });
    render(await NotFound());
    expect(screen.getByRole("link", { name: "Open kitchen" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("shows Sign in when Clerk auth has no userId", async () => {
    auth.mockResolvedValue({ userId: null });
    render(await NotFound());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open kitchen" })).not.toBeInTheDocument();
  });
});
