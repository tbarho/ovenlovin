import type { Metadata } from "next";
import Link from "next/link";
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
      <p className="lead">Deploy your own OvenLovin, then connect your agent with an API key.</p>
      <p>
        New here? <Link href="/docs#start-here">Start here</Link>.
      </p>
      <p className="intro">
        Send your key as <code>Authorization: ApiKey YOUR_KEY</code>. <code>Bearer</code> works in
        place of <code>ApiKey</code>. Allergen findings name the person and the ingredient - not
        medical advice. Always read the label.
      </p>
      <p className="intro">
        Just looking? The public demo at <code>https://ovenlovin-demo.vercel.app</code> issues a 24h
        sandbox key at <code>/api/demo/enter?format=json</code>.
      </p>
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
