import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";
import { clerkUnavailableCopy } from "@/lib/clerk-unavailable";
import { isDemoModeEnabled } from "@/lib/demo/mode";

export default function SignInPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const demo = isDemoModeEnabled();
  const unavailable = clerkUnavailableCopy(demo);

  return (
    <div className="shell">
      <div className="wrap page-narrow" style={{ display: "grid", justifyItems: "center" }}>
        <Link href="/" className="brand">
          <Image src={brandPublicPath.mark} alt="" width={40} height={40} unoptimized />
          OvenLovin
        </Link>
        <h1>{clerkEnabled && !demo ? "Sign in" : unavailable.title}</h1>
        {clerkEnabled && !demo ? (
          <SignIn fallbackRedirectUrl="/recipes" />
        ) : (
          <>
            <p className="empty-note">{unavailable.body}</p>
            <Link className="btn primary" href={unavailable.href}>
              {unavailable.linkLabel}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
