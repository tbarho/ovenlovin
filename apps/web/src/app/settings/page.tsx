import { headers } from "next/headers";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { KitchenInvites } from "@/components/settings/KitchenInvites";
import { KitchenMembers } from "@/components/settings/KitchenMembers";
import { DefaultServingsSettings } from "@/components/settings/DefaultServingsSettings";
import { KitchenNameSettings } from "@/components/settings/KitchenNameSettings";
import { KitchenSwitcher } from "@/components/settings/KitchenSwitcher";
import { DemoAgentPanel } from "@/components/demo/DemoAgentPanel";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { getDemoSandboxForSession } from "@/lib/demo/session";
import { shortBuildSha } from "@/lib/build-sha";
import { canWriteKitchen } from "@ovenlovin/core";
import { requireKitchenContext } from "@/lib/kitchen-session";
import { resolveOrigin } from "@/lib/origin";

export default async function SettingsPage() {
  const context = await requireKitchenContext("/settings");

  const demo = isDemoModeEnabled();
  const sandbox = demo ? await getDemoSandboxForSession() : null;
  const origin = resolveOrigin(await headers());
  const buildSha = shortBuildSha();
  const canManageInvites = context.membershipRole === "owner" || context.membershipRole === "admin";
  const canWrite = canWriteKitchen(context.membershipRole);

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
              : "Invite family into this kitchen, then add API keys for Grok, Claude, ChatGPT, and other MCP clients."}
            {buildSha ? ` Build ${buildSha}.` : ""}
          </p>
        </div>
      </div>
      <KitchenNameSettings canRename={context.membershipRole === "owner"} />
      <KitchenSwitcher />
      <DefaultServingsSettings canWrite={canWrite} />
      <KitchenMembers currentUserId={context.userId} currentRole={context.membershipRole} />
      <KitchenInvites canManage={canManageInvites} />
      {demo && sandbox ? (
        <DemoAgentPanel origin={origin} apiKey={sandbox.apiKeyPlaintext} />
      ) : (
        <ApiKeyManager />
      )}
    </>
  );
}
