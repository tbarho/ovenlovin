import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";
import type { ConfigStatus } from "@ovenlovin/core/onboarding";
import { ConnectAgentSection } from "./ConnectAgentSection";
import { SiteHeader } from "./SiteHeader";
import { StatusStrip } from "./StatusStrip";

export function LandingPage({
  instanceName,
  origin,
  status,
  signedIn,
  clerkEnabled,
}: {
  instanceName: string;
  origin: string;
  status: ConfigStatus;
  signedIn: boolean;
  clerkEnabled: boolean;
}) {
  return (
    <div className="shell">
      <SiteHeader signedIn={signedIn} clerkEnabled={clerkEnabled} />
      <main>
        <section className="hero">
          <div className="wrap rise">
            <Image
              className="hero-mark"
              src={brandPublicPath.mark}
              alt="OvenLovin oven mark"
              width={164}
              height={164}
              priority
              unoptimized
            />
            <div className="badge">
              <i />
              {instanceName}
            </div>
            <h1>Family recipes, ready for your agents.</h1>
            <p className="lead">
              Import a recipe, set per-person rules, and hand the same kitchen to Grok, Claude, or
              ChatGPT. This deploy is {instanceName}.
            </p>
            <div className="hero-ctas" id="start">
              {signedIn ? (
                <Link className="btn primary" href="/recipes">
                  Start cooking
                </Link>
              ) : clerkEnabled ? (
                <Link className="btn primary" href="/sign-in">
                  Sign in / start cooking
                </Link>
              ) : (
                <a className="btn primary" href="#status">
                  Finish setup to sign in
                </a>
              )}
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
            </div>
          </div>
        </section>

        <div className="wrap">
          <div className="paths">
            <Link
              className="path-card"
              href={signedIn ? "/recipes" : clerkEnabled ? "/sign-in" : "#status"}
            >
              <span className="kicker">01</span>
              <h2>Sign in and cook</h2>
              <p>
                Create your household on first sign-in, then import recipes and set people rules.
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
          </div>
        </div>

        <section className="section" id="status">
          <div className="wrap">
            <h2>This instance</h2>
            <p className="intro">
              A quick look at whether the database, Clerk, and AI Gateway landed with the deploy.
            </p>
            <StatusStrip status={status} />
          </div>
        </section>

        <section className="section" id="connect">
          <div className="wrap">
            <h2>Connect your agent</h2>
            <p className="intro">
              These snippets already use this origin ({origin}). Sign in to generate an API key,
              then paste.
            </p>
            <ConnectAgentSection origin={origin} signedIn={signedIn} />
          </div>
        </section>
      </main>
      <footer className="footer wrap">
        <span>{instanceName} · OvenLovin</span>
        <a href="https://github.com/tbarho/ovenlovin">GitHub</a>
      </footer>
    </div>
  );
}
