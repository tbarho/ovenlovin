import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkProtectExempt } from "@/lib/clerk-protect";
import { DEMO_ENTER_PATH, shouldRedirectToDemoEnter } from "@/lib/demo/enter";
import { DEMO_COOKIE_NAME } from "@/lib/demo/fixture";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { isDevPreviewAllowed, isDevPreviewPath } from "@/lib/dev-routes";
import { isE2eAuthBypassEnabled } from "@/lib/e2e-auth";
import { inviteTokenFromPathname } from "@/lib/invite-path";
import { INVITE_COOKIE, inviteCookieOptions } from "@/lib/kitchen-cookies";

function withInviteCookie(req: NextRequest, response: NextResponse): NextResponse {
  const token = inviteTokenFromPathname(req.nextUrl.pathname);
  if (token) {
    response.cookies.set(INVITE_COOKIE, token, inviteCookieOptions);
  }
  return response;
}

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const clerk = clerkMiddleware(async (auth, req) => {
  if (isClerkProtectExempt(req.nextUrl.pathname)) return;
  await auth.protect();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isDevPreviewPath(req.nextUrl.pathname) && !isDevPreviewAllowed()) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (isE2eAuthBypassEnabled()) {
    return withInviteCookie(req, NextResponse.next());
  }
  if (isDemoModeEnabled()) {
    if (shouldRedirectToDemoEnter(req.nextUrl.pathname, req.cookies.get(DEMO_COOKIE_NAME)?.value)) {
      const enter = req.nextUrl.clone();
      enter.pathname = DEMO_ENTER_PATH;
      enter.search = `?next=${encodeURIComponent(`${req.nextUrl.pathname}${req.nextUrl.search}`)}`;
      return withInviteCookie(req, NextResponse.redirect(enter));
    }
    return withInviteCookie(req, NextResponse.next());
  }
  if (clerkConfigured) {
    const result = clerk(req, event);
    return Promise.resolve(result).then((res) => {
      if (!inviteTokenFromPathname(req.nextUrl.pathname)) {
        return res ?? NextResponse.next();
      }
      if (res instanceof NextResponse) return withInviteCookie(req, res);
      if (!res) return withInviteCookie(req, NextResponse.next());
      return res;
    });
  }
  return withInviteCookie(req, NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
