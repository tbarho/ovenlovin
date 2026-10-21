"use client";

import { ClerkProvider } from "@clerk/nextjs";

const clerkAppearance = {
  variables: {
    colorPrimary: "#B85420",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorNeutral: "#161310",
    colorText: "#161310",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: "16px",
    borderRadius: "8px",
  },
  elements: {
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
    <ClerkProvider appearance={clerkAppearance} publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}
