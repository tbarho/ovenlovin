import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";
import { clerkUnavailableCopy } from "@/lib/clerk-unavailable";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import { authRedirectOrigins } from "@/lib/auth-redirect-origins";
import { isDemoModeEnabled } from "@/lib/demo/mode";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const demo = isDemoModeEnabled();
  const unavailable = clerkUnavailableCopy(demo);
  const redirectUrl = safeAuthRedirect(
    (await searchParams).redirect_url,
    await authRedirectOrigins()
  );
  const joiningKitchen = redirectUrl.startsWith("/invite/");
  return (
    <div className="shell">
      <div className="wrap auth-screen">
        <Link href="/" className="brand">
          <Image src={brandPublicPath.mark} alt="" width={40} height={40} unoptimized />
          OvenLovin
        </Link>
        {clerkEnabled && !demo ? (
          <>
            {joiningKitchen ? <p className="empty-note">Join this kitchen</p> : null}
            <SignUp fallbackRedirectUrl={redirectUrl} />
          </>
        ) : (
          <>
            <h1>{unavailable.title}</h1>
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
