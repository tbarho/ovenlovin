import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { describeDeployResolved, getInstanceName } from "@ovenlovin/core/onboarding";
import { LandingPage } from "@/components/landing/LandingPage";
import { getPublicDemoUrl, isDemoModeEnabled } from "@/lib/demo/mode";
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
  if (isDemoModeEnabled()) {
    redirect("/recipes");
  }

  const headerStore = await headers();
  const origin = resolveOrigin(headerStore);
  const instanceName = getInstanceName(process.env.NEXT_PUBLIC_INSTANCE_NAME);
  const status = await getConfigStatus();
  const signedIn = await isSignedIn();
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const deploy = await describeDeployResolved(
    {
      ...process.env,
      // Next only inlines next.config `env` on a static property access, not via process.env spread.
      NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME,
    },
    { origin, fetch }
  );

  return (
    <LandingPage
      instanceName={instanceName}
      origin={origin}
      status={status}
      signedIn={signedIn}
      clerkEnabled={clerkEnabled}
      deploy={deploy}
      demoUrl={getPublicDemoUrl()}
    />
  );
}
