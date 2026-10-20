import type { Metadata } from "next";
import { headers } from "next/headers";
import { ConnectAgent } from "@/components/landing/ConnectAgent";
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
        Point Claude, ChatGPT, or Grok at this instance. Auth is{" "}
        <code>Authorization: ApiKey rkapi_…</code> (Bearer + the same key also works).
      </p>
      <p className="intro">
        Copy the API key from Settings (the public demo already shows a sandbox key), then paste
        it into the snippet. Allergen findings name the person and the ingredient - not medical
        advice. Always check labels.
      </p>
      <ConnectAgent origin={origin} />
      <h2>Claude Code</h2>
      <p className="intro">Remote HTTP is the supported path. After you have a key:</p>
      <pre className="copy-pre">
        {`claude mcp add --transport http ovenlovin ${origin}/mcp \\
  --header "Authorization: ApiKey YOUR_OVENLOVIN_API_KEY"`}
      </pre>
      <h2>Safety</h2>
      <p className="intro">
        Call <code>check_meal_plan</code> before <code>save_meal_plan</code>. If checking cannot
        finish, the result is <code>status: incomplete</code> - never treat that as “no issues”.
      </p>
    </DocsChrome>
  );
}
