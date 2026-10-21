import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";

export default async function NotFound() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  let signedIn = false;
  if (clerkEnabled) {
    try {
      const { currentUser } = await import("@clerk/nextjs/server");
      signedIn = Boolean(await currentUser());
    } catch {
      signedIn = false;
    }
  }

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
              signedIn ? (
                <Link className="btn" href="/recipes">
                  Open kitchen
                </Link>
              ) : (
                <Link className="btn" href="/sign-in">
                  Sign in
                </Link>
              )
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
