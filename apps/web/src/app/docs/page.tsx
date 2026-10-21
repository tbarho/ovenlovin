import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { DocsChrome } from "@/components/docs/DocsChrome";
import { OVENLOVIN_PITCH } from "@/lib/llms-txt";
import { resolveOrigin } from "@/lib/origin";

export const metadata: Metadata = {
  title: "Docs · OvenLovin",
  description: OVENLOVIN_PITCH,
};

export default async function DocsIndexPage() {
  const origin = resolveOrigin(await headers());

  return (
    <DocsChrome current="index">
      <p className="eyebrow">Docs</p>
      <h1>OvenLovin for humans and agents</h1>
      <p className="lead">{OVENLOVIN_PITCH}</p>
      <p className="intro">
        This instance is <code>{origin}</code>. Open Settings to copy the sandbox key, or sign in on
        a full kitchen to mint one. Allergen checks are deterministic and{" "}
        <span className="nowrap">per-person</span> - not medical advice. Always read the label.
      </p>
      <ul className="yours-row">
        <li>
          <span>MCP</span>
          <b>
            <code>{origin}/mcp</code>
          </b>
        </li>
        <li>
          <span>REST</span>
          <b>
            <code>{origin}/api/v1</code>
          </b>
        </li>
        <li>
          <span>OpenAPI</span>
          <b>
            <code>
              {`${origin}/api/v1/openapi.json`
                .split("/")
                .flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, `/${part}`]))}
            </code>
          </b>
        </li>
      </ul>
      <div className="hero-ctas">
        <Link className="btn primary" href="/docs/connect-your-agent">
          Connect your agent
        </Link>
        <a className="btn" href="/llms.txt">
          llms.txt
        </a>
        <a className="btn ghost" href="https://tbarho.github.io/ovenlovin/" rel="noreferrer">
          Full reference
        </a>
      </div>
      <h2>Start here</h2>
      <ol>
        <li>Copy the API key from Settings. The public demo already has a sandbox key.</li>
        <li>
          Paste the snippet from <Link href="/docs/connect-your-agent">Connect your agent</Link>{" "}
          into Claude Code, Claude Desktop, ChatGPT, or Grok.
        </li>
        <li>
          Ask <code>whoami</code>, then <code>get_household_context</code>, then plan a week and
          call <code>check_meal_plan</code> before saving.
        </li>
      </ol>
    </DocsChrome>
  );
}
