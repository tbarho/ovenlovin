import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";

export default function SignInPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="shell">
      <div className="wrap page-narrow" style={{ display: "grid", justifyItems: "center" }}>
        <Link href="/" className="brand">
          <Image src={brandPublicPath.mark} alt="" width={40} height={40} unoptimized />
          OvenLovin
        </Link>
        <h1>Sign in</h1>
        {clerkEnabled ? (
          <SignIn fallbackRedirectUrl="/recipes" />
        ) : (
          <p className="empty-note">
            Clerk is not configured on this instance. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and
            CLERK_SECRET_KEY, or install the Clerk integration from the Deploy to Vercel flow.
          </p>
        )}
      </div>
    </div>
  );
}
