import type { Metadata } from "next";
import { headers } from "next/headers";
import { ConnectAgent } from "@/components/landing/ConnectAgent";
import { OverflowX } from "@/components/landing/OverflowX";
import { DocsChrome } from "@/components/docs/DocsChrome";
import { OVENLOVIN_PITCH } from "@/lib/llms-txt";
import { resolveOrigin } from "@/lib/origin";

export const metadata: Metadata = {
  title: "Connect your agent · OvenLovin",
  description: OVENLOVIN_PITCH,
};

export default async function ConnectYourAgentPage() {
  const origin = resolveOrigin(await headers());

  return (
    <DocsChrome current="connect">
      <p className="eyebrow">Agents</p>
      <h1>Connect your agent</h1>
      <p className="lead">
        You deploy your own copy, and the public demo at{" "}
        <code>https://ovenlovin-demo.vercel.app</code> is optional.
      </p>
      <p className="intro">
        Bearer plus the same key also works. Allergen findings name the person and the ingredient -
        not medical advice. Always read the label.
      </p>
      <h2>Start here</h2>
      <ol>
        <li>
          Deploy your own copy (Deploy button), sign in, open Settings, then API keys, create a key,
          and copy the <code>plaintext</code> value (shown once).
        </li>
        <li>
          Call{" "}
          <code>
            {"https://<your-app>.vercel.app"}
            <wbr />
            /api/v1
          </code>{" "}
          with <code>Authorization: ApiKey rkapi_...</code> and connect MCP at{" "}
          <code>
            {"https://<your-app>.vercel.app"}
            <wbr />
            /mcp
          </code>
          .
        </li>
        <li>
          Just looking? The public demo at <code>https://ovenlovin-demo.vercel.app</code> issues a
          24h sandbox key at <code>/api/demo/enter?format=json</code>.
        </li>
      </ol>
      <ConnectAgent origin={origin} />
      <h2>Claude Code</h2>
      <p className="intro">Remote HTTP is the supported path. After you have a key:</p>
      <OverflowX className="copy-pre">
        <pre data-scroll tabIndex={0} role="region" aria-label="Claude Code command">
          {`claude mcp add --transport http ovenlovin ${origin}/mcp \\
  --header "Authorization: ApiKey YOUR_OVENLOVIN_API_KEY"`}
        </pre>
      </OverflowX>
      <h2>Safety</h2>
      <p className="intro">
        Call <code>check_meal_plan</code> before <code>save_meal_plan</code>. If checking cannot
        finish, the result is <code>status: incomplete</code> - never treat that as “no issues”.
      </p>
    </DocsChrome>
  );
}
