"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { brandTokens } from "@/lib/brand-tokens";
import { clerkUrls } from "@/lib/clerk-urls";

export const clerkAppearance = {
  variables: {
    colorPrimary: brandTokens.orangePress,
    colorBackground: brandTokens.bg,
    colorInputBackground: brandTokens.bg,
    colorNeutral: brandTokens.ink,
    colorText: brandTokens.ink,
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: "16px",
    borderRadius: "8px",
  },
  elements: {
    cardBox: {
      boxShadow: "none",
      border: "1px solid var(--border)",
      borderRadius: "8px",
    },
    card: {
      boxShadow: "none",
      border: "none",
      borderRadius: "0",
    },
    headerTitle: {
      fontSize: "20px",
      fontWeight: 600,
      lineHeight: "28px",
    },
    formButtonPrimary: { height: "44px", minHeight: "44px" },
    formFieldInput: { height: "44px", minHeight: "44px" },
    socialButtonsBlockButton: { height: "44px", minHeight: "44px" },
  },
};

export function ClerkReadyProvider({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return children;
  }

  return (
    <ClerkProvider appearance={clerkAppearance} publishableKey={publishableKey} {...clerkUrls()}>
      {children}
    </ClerkProvider>
  );
}
