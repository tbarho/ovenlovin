import { SignedIn, SignedOut } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";

export default function NotFound() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="shell">
      <header className="nav">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="OvenLovin">
            <Image src={brandPublicPath.mark} alt="" width={34} height={34} unoptimized />
            OvenLovin
          </Link>
          <div className="nav-cta">
            <Link className="btn" href="/docs">
              Docs
            </Link>
            {clerkEnabled ? (
              <>
                <SignedOut>
                  <Link className="btn" href="/sign-in">
                    Sign in
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link className="btn" href="/recipes">
                    Open kitchen
                  </Link>
                </SignedIn>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main>
        <section className="section">
          <div className="wrap">
            <div className="not-found">
              <h1>We couldn&apos;t find that page</h1>
              <p>It may have been moved, or the link is out of date.</p>
              <Link className="btn primary" href="/">
                Back home
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
