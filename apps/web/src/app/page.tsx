import { headers } from "next/headers";
import { describeDeploy, getInstanceName } from "@ovenlovin/core/onboarding";
import { LandingPage } from "@/components/landing/LandingPage";
import { resolveOrigin } from "@/lib/origin";
import { getConfigStatus } from "@/lib/status";

async function isSignedIn(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return false;
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    return Boolean(await currentUser());
  } catch {
    return false;
  }
}

export default async function Home() {
  const headerStore = await headers();
  const origin = resolveOrigin(headerStore);
  const instanceName = getInstanceName(process.env.NEXT_PUBLIC_INSTANCE_NAME);
  const status = await getConfigStatus();
  const signedIn = await isSignedIn();
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const deploy = describeDeploy(process.env, { origin });

  return (
    <LandingPage
      instanceName={instanceName}
      origin={origin}
      status={status}
      signedIn={signedIn}
      clerkEnabled={clerkEnabled}
      deploy={deploy}
    />
  );
}
