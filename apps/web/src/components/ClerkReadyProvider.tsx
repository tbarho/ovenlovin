"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkUrls } from "@/lib/clerk-urls";

export function ClerkReadyProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return children;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} {...clerkUrls()}>
      {children}
    </ClerkProvider>
  );
}
