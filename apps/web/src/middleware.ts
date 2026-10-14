import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkProtectExempt } from "@/lib/clerk-protect";
import { DEMO_ENTER_PATH, shouldRedirectToDemoEnter } from "@/lib/demo/enter";
import { DEMO_COOKIE_NAME } from "@/lib/demo/fixture";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { isE2eAuthBypassEnabled } from "@/lib/e2e-auth";

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const clerk = clerkMiddleware(async (auth, req) => {
  if (isClerkProtectExempt(req.nextUrl.pathname)) return;
  await auth.protect();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isE2eAuthBypassEnabled()) {
    return NextResponse.next();
  }
  if (isDemoModeEnabled()) {
    if (shouldRedirectToDemoEnter(req.nextUrl.pathname, req.cookies.get(DEMO_COOKIE_NAME)?.value)) {
      const enter = req.nextUrl.clone();
      enter.pathname = DEMO_ENTER_PATH;
      enter.search = `?next=${encodeURIComponent(`${req.nextUrl.pathname}${req.nextUrl.search}`)}`;
      return NextResponse.redirect(enter);
    }
    return NextResponse.next();
  }
  if (clerkConfigured) {
    return clerk(req, event);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
