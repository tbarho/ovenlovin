import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";
import "@/components/ui/ui.css";

/** Nav density matches the 14px nav links, so Docs, kitchen, and sign-in use the medium control. */
const navCtaClass = "ds-button ds-button--secondary ds-button--md";
const homeCtaClass = "ds-button ds-button--default ds-button--md";

export default async function NotFound() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  let signedIn = false;
  if (clerkEnabled) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      signedIn = Boolean((await auth()).userId);
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
            <Link className={navCtaClass} href="/docs">
              Docs
            </Link>
            {clerkEnabled ? (
              signedIn ? (
                <Link className={navCtaClass} href="/recipes">
                  Open kitchen
                </Link>
              ) : (
                <Link className={navCtaClass} href="/sign-in">
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
              <Link className={homeCtaClass} href="/">
                Back home
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
