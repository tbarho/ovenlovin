import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UnauthorizedError } from "@/lib/api/errors";
import type { RequestContext } from "@/lib/api/middleware";
import { DEMO_ENTER_PATH, safeDemoEnterNext } from "./enter";
import { DEMO_COOKIE_NAME } from "./fixture";
import { findDemoSandboxById, sandboxToSession } from "./sandbox";

export async function getDemoSessionContext(options?: {
  allowRedirect?: boolean;
}): Promise<RequestContext> {
  const store = await cookies();
  const cookieId = store.get(DEMO_COOKIE_NAME)?.value;
  const sandbox = cookieId ? await findDemoSandboxById(cookieId) : null;
  if (!sandbox) {
    if (options?.allowRedirect === false) {
      throw new UnauthorizedError("Authentication required");
    }
    redirect(`${DEMO_ENTER_PATH}?next=${encodeURIComponent(safeDemoEnterNext("/recipes"))}`);
  }
  return sandboxToSession(sandbox);
}

export async function getDemoAgentCredentials(): Promise<{
  apiKey: string;
  expiresAt: string;
} | null> {
  const store = await cookies();
  const cookieId = store.get(DEMO_COOKIE_NAME)?.value;
  if (!cookieId) return null;
  const sandbox = await findDemoSandboxById(cookieId);
  if (!sandbox) return null;
  return {
    apiKey: sandbox.apiKeyPlaintext,
    expiresAt: sandbox.expiresAt.toISOString(),
  };
}
