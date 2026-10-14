import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { DemoAgentPanel } from "@/components/demo/DemoAgentPanel";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { findDemoSandboxByHousehold } from "@/lib/demo/sandbox";
import { resolveOrigin } from "@/lib/origin";
import { getSessionContext } from "@/lib/session";

export default async function SettingsPage() {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const demo = isDemoModeEnabled();
  const sandbox = demo ? await findDemoSandboxByHousehold(context.householdId) : null;
  const origin = resolveOrigin(await headers());

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            Household
          </p>
          <h1>Settings</h1>
          <p className="muted">
            {demo
              ? "Sandbox MCP URL and API key for this demo visit. Resets daily."
              : "API keys for Grok, Claude, ChatGPT, and other MCP clients."}
          </p>
        </div>
      </div>
      {demo && sandbox ? (
        <DemoAgentPanel origin={origin} apiKey={sandbox.apiKeyPlaintext} />
      ) : (
        <ApiKeyManager />
      )}
    </>
  );
}
