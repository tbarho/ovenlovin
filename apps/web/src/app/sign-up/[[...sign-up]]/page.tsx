import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";

export default function SignUpPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="shell">
      <div className="wrap page-narrow" style={{ display: "grid", justifyItems: "center" }}>
        <Link href="/" className="brand">
          <Image src={brandPublicPath.mark} alt="" width={40} height={40} unoptimized />
          OvenLovin
        </Link>
        <h1>Create your kitchen</h1>
        {clerkEnabled ? (
          <SignUp fallbackRedirectUrl="/recipes" />
        ) : (
          <p className="empty-note">
            Clerk is not configured on this instance. Add the Clerk keys, then reload this page to
            create an account.
          </p>
        )}
      </div>
    </div>
  );
}
