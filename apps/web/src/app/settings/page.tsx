import { redirect } from "next/navigation";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { getSessionContext } from "@/lib/session";

export default async function SettingsPage() {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            Household
          </p>
          <h1>Settings</h1>
          <p className="muted">API keys for Grok, Claude, ChatGPT, and other MCP clients.</p>
        </div>
      </div>
      <ApiKeyManager />
    </>
  );
}
