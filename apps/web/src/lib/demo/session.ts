import { cookies } from "next/headers";
import type { RequestContext } from "@/lib/api/middleware";
import { DEMO_COOKIE_NAME } from "./fixture";
import { demoCookieOptions, getOrCreateDemoSandbox, sandboxToSession } from "./sandbox";

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export async function getDemoSessionContext(): Promise<RequestContext> {
  const store = await cookies();
  const sandbox = await getOrCreateDemoSandbox(store.get(DEMO_COOKIE_NAME)?.value);
  store.set(DEMO_COOKIE_NAME, sandbox.id, demoCookieOptions(cookieSecure()));
  return sandboxToSession(sandbox);
}

export async function getDemoAgentCredentials(): Promise<{
  apiKey: string;
  expiresAt: string;
} | null> {
  const store = await cookies();
  const cookieId = store.get(DEMO_COOKIE_NAME)?.value;
  if (!cookieId) return null;
  const sandbox = await getOrCreateDemoSandbox(cookieId);
  return {
    apiKey: sandbox.apiKeyPlaintext,
    expiresAt: sandbox.expiresAt.toISOString(),
  };
}
