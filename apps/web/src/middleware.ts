import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { isClerkProtectExempt } from "@/lib/clerk-protect";
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
  if (isE2eAuthBypassEnabled() || isDemoModeEnabled()) {
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
