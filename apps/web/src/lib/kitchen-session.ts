import { redirect, unstable_rethrow } from "next/navigation";
import type { RequestContext } from "@/lib/api/middleware";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { DEMO_ENTER_PATH, safeDemoEnterNext } from "@/lib/demo/enter";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { getSessionContext } from "@/lib/session";

export function demoKitchenEnterHref(next = "/recipes"): string {
  return `${DEMO_ENTER_PATH}?next=${encodeURIComponent(safeDemoEnterNext(next))}`;
}

/**
 * Load the kitchen session without swallowing demo `redirect()` to
 * `/api/demo/enter`. Catching that redirect used to dump visitors on
 * `/sign-in` and mint a fresh sandbox on the next enter.
 */
export async function requireKitchenContext(
  next?: string
): Promise<RequestContext & { householdId: string }> {
  const signIn = next
    ? `/sign-in?redirect_url=${encodeURIComponent(safeAuthRedirect(next))}`
    : "/sign-in";
  try {
    const context = await getSessionContext();
    if (!context.householdId) {
      if (isDemoModeEnabled()) {
        redirect(demoKitchenEnterHref(next ?? "/recipes"));
      }
      redirect(signIn);
    }
    return { ...context, householdId: context.householdId };
  } catch (error) {
    unstable_rethrow(error);
    if (isDemoModeEnabled()) {
      redirect(demoKitchenEnterHref(next ?? "/recipes"));
    }
    redirect(signIn);
  }
}
