import { headers } from "next/headers";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { DemoAgentPanel } from "@/components/demo/DemoAgentPanel";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { findDemoSandboxByHousehold } from "@/lib/demo/sandbox";
import { requireKitchenContext } from "@/lib/kitchen-session";
import { resolveOrigin } from "@/lib/origin";

export default async function SettingsPage() {
  const context = await requireKitchenContext();

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
