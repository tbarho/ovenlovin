import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isE2eAuthBypassEnabled } from "@/lib/e2e-auth";

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/health(.*)",
  "/api/v1/status(.*)",
  "/api/v1/openapi.json",
  "/mcp(.*)",
  "/brand(.*)",
  "/prototype(.*)",
  "/dev/people-preview(.*)",
]);

const clerk = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (isE2eAuthBypassEnabled()) {
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
