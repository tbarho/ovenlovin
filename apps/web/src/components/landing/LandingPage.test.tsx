import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConfigStatus, DeployInfo } from "@ovenlovin/core/onboarding";
import { OVENLOVIN_PITCH } from "@/lib/llms-txt";
import { LandingPage } from "./LandingPage";

const deploy: DeployInfo = {
  live: true,
  environment: "production",
  environmentLabel: "Production",
  headline: "You're live.",
  instanceUrl: "https://ovenlovin.vercel.app",
  instanceHost: "ovenlovin.vercel.app",
  deployedAt: null,
  vercel: {
    projectUrl: "https://vercel.com/ty-barho/ovenlovin",
    deploymentUrl: "https://vercel.com/ty-barho/ovenlovin/abc",
  },
  github: {
    repoUrl: "https://github.com/tbarho/ovenlovin",
    commitUrl: "https://github.com/tbarho/ovenlovin/commit/abc",
    owner: "tbarho",
    slug: "ovenlovin",
    commitSha: "abc1234",
    commitShort: "abc1234",
    commitRef: "main",
    commitMessage: "fix: internal commit visitors must not see",
  },
};

const status: ConfigStatus = {
  ready: true,
  mode: "product",
  commitSha: "abc1234",
  checks: [],
};

const shared = {
  instanceName: "Ty's kitchen",
  origin: "https://ovenlovin.vercel.app",
  status,
  clerkEnabled: true,
  deploy,
};

describe("LandingPage", () => {
  it("shows marketing copy to visitors and hides deploy internals", () => {
    render(<LandingPage {...shared} signedIn={false} />);

    expect(screen.getByRole("heading", { name: OVENLOVIN_PITCH })).toBeInTheDocument();
    expect(screen.queryByText("You're live.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("This is yours — Ty's kitchen. Your household. Your data.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("fix: internal commit visitors must not see")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Project dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("owner-status")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "You're live" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect an agent" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Try the demo" })).not.toBeInTheDocument();
  });

  it("shows the public demo CTA when a demo URL is configured", () => {
    render(<LandingPage {...shared} signedIn={false} demoUrl="https://demo.example" />);
    const demos = screen.getAllByRole("link", { name: "Try the demo" });
    expect(demos.length).toBeGreaterThan(0);
    expect(demos.every((link) => link.getAttribute("href") === "https://demo.example")).toBe(true);
  });

  it("shows owner internals after sign-in", () => {
    render(<LandingPage {...shared} signedIn />);

    expect(screen.getByRole("heading", { name: "You're live." })).toBeInTheDocument();
    expect(
      screen.getByText("This is yours — Ty's kitchen. Your household. Your data.")
    ).toBeInTheDocument();
    expect(screen.getByText("fix: internal commit visitors must not see")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Project dashboard" })).toBeInTheDocument();
    expect(screen.getByTestId("owner-status")).toBeInTheDocument();
  });
});
