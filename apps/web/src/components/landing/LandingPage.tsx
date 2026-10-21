import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";
import type { ConfigStatus, DeployInfo } from "@ovenlovin/core/onboarding";
import { formatDeployedAt } from "@ovenlovin/core/onboarding";
import { OVENLOVIN_PITCH } from "@/lib/llms-txt";
import { ConnectAgentSection } from "./ConnectAgentSection";
import { SiteHeader } from "./SiteHeader";
import { StatusStrip } from "./StatusStrip";
import { VercelBand } from "./VercelBand";

export function LandingPage({
  instanceName,
  origin,
  status,
  signedIn,
  clerkEnabled,
  deploy,
  demoUrl,
}: {
  instanceName: string;
  origin: string;
  status: ConfigStatus;
  signedIn: boolean;
  clerkEnabled: boolean;
  deploy: DeployInfo;
  demoUrl?: string | null;
}) {
  const deployed = deploy.deployedAt ? formatDeployedAt(deploy.deployedAt) : null;
  const pillLabel = deploy.live ? "Live" : deploy.environmentLabel;
  const kitchenHref = signedIn ? "/recipes" : clerkEnabled ? "/sign-in" : "#status";

  return (
    <div className="shell">
      <SiteHeader signedIn={signedIn} clerkEnabled={clerkEnabled} demoUrl={demoUrl} />
      <main>
        <section className="hero" id="live">
          <div className="wrap">
            <div className="hero-identity">
              <Image
                className="hero-mark"
                src={brandPublicPath.mark}
                alt="OvenLovin oven mark"
                width={164}
                height={164}
                priority
                unoptimized
              />
              {signedIn ? (
                <>
                  <div className={`live-pill ${deploy.live ? "is-live" : "is-local"}`}>
                    <i className="live-dot" aria-hidden="true" />
                    <span className="live-label">{pillLabel}</span>
                    <a className="live-url" href={deploy.instanceUrl}>
                      {deploy.instanceHost}
                    </a>
                  </div>
                  {deployed ? (
                    <p className="hero-deployed" title={deployed.iso}>
                      Deployed {deployed.absolute}
                      {deployed.relative ? ` · ${deployed.relative}` : ""}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <h1>{signedIn ? deploy.headline : OVENLOVIN_PITCH}</h1>
            <p className="lead">
              {signedIn ? (
                `This is yours - ${instanceName}. Your household. Your data.`
              ) : (
                <>
                  Open-source recipe box for families and their agents.{" "}
                  <span className="nowrap">Per-person</span> allergen checks. Not medical advice -
                  always read the label.
                </>
              )}
            </p>
            {signedIn ? (
              <ul className="yours-row">
                <li>
                  <span>Instance</span>
                  <b>{instanceName}</b>
                </li>
                <li>
                  <span>Household</span>
                  <b>Yours</b>
                </li>
                <li>
                  <span>Data</span>
                  <b>On this deploy</b>
                </li>
              </ul>
            ) : null}
            <div className="hero-ctas" id="start">
              {signedIn ? (
                <Link className="btn primary" href="/recipes">
                  Start cooking
                </Link>
              ) : demoUrl ? (
                <a className="btn primary" href={demoUrl}>
                  Try the demo
                </a>
              ) : clerkEnabled ? (
                <Link className="btn primary" href="/sign-in">
                  Sign in / start cooking
                </Link>
              ) : (
                <a className="btn primary" href="#status">
                  Finish setup to sign in
                </a>
              )}
              {!signedIn && demoUrl && clerkEnabled ? (
                <Link className="btn" href="/sign-in">
                  Sign in
                </Link>
              ) : null}
              <a
                className="btn"
                href="https://tbarho.github.io/ovenlovin/"
                target="_blank"
                rel="noreferrer"
              >
                Read the docs
              </a>
              <a className="btn ghost" href="#connect">
                Connect your agent
              </a>
              <a className="btn ghost" href="#migrate">
                Migrate from ReciMe
              </a>
            </div>
            {signedIn ? <VercelBand deploy={deploy} /> : null}
          </div>
        </section>

        <div className="wrap">
          <div className="paths">
            <Link className="path-card" href={kitchenHref}>
              <span className="kicker">01</span>
              <h2>{signedIn ? "Open the kitchen" : "Sign in and cook"}</h2>
              <p>
                {signedIn
                  ? "Recipes, this week’s plan, the shopping list, and people rules - on this household."
                  : "Create your household on first sign-in, then import recipes and set people rules."}
              </p>
            </Link>
            <a
              className="path-card"
              href="https://tbarho.github.io/ovenlovin/"
              target="_blank"
              rel="noreferrer"
            >
              <span className="kicker">02</span>
              <h2>Read the docs</h2>
              <p>Self-hosting, MCP tools, importers, and the safety-critical rule checker.</p>
            </a>
            <a className="path-card" href="#connect">
              <span className="kicker">03</span>
              <h2>Connect an agent</h2>
              <p>Copy a ready-to-paste prompt for Grok, Claude, ChatGPT, or any MCP client.</p>
            </a>
            <a className="path-card" href="#migrate">
              <span className="kicker">04</span>
              <h2>Migrate from ReciMe</h2>
              <p>
                A copyable agent prompt that signs into ReciMe, walks every folder, and imports
                cookbooks and recipes here.
              </p>
            </a>
          </div>
        </div>

        {signedIn ? (
          <section className="section" id="status" data-testid="owner-status">
            <div className="wrap">
              <h2>This instance</h2>
              <p className="intro">
                A quick look at whether the database, Clerk, and AI Gateway landed with the deploy.
              </p>
              <StatusStrip status={status} />
            </div>
          </section>
        ) : clerkEnabled ? null : (
          <section className="section" id="status">
            <div className="wrap">
              <h2>Finish setup</h2>
              <p className="intro">
                Clerk is not configured on this deploy yet. Status below is for the person setting
                the instance up.
              </p>
              <StatusStrip status={status} />
            </div>
          </section>
        )}

        <ConnectAgentSection origin={origin} signedIn={signedIn} />
      </main>
      <footer className="footer wrap">
        <span>
          {signedIn ? `${instanceName} · ` : ""}
          OvenLovin
          {signedIn ? ` · ${deploy.instanceHost}` : ""}
          {deploy.github.commitShort ? ` · ${deploy.github.commitShort}` : ""}
        </span>
        {deploy.github.repoUrl ? (
          <a href={deploy.github.repoUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        ) : (
          <a href="https://github.com/tbarho/ovenlovin">GitHub</a>
        )}
      </footer>
    </div>
  );
}
