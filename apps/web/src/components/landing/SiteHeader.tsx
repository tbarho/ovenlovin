import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";

export function SiteHeader({
  signedIn,
  clerkEnabled,
  demoUrl,
}: {
  signedIn: boolean;
  clerkEnabled: boolean;
  demoUrl?: string | null;
}) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <Image src={brandPublicPath.mark} alt="" width={34} height={34} unoptimized />
          OvenLovin
        </Link>
        <ul className="nav-links">
          {signedIn ? (
            <li>
              <a href="#live">You&apos;re live</a>
            </li>
          ) : null}
          <li>
            <a href="#connect">Connect an agent</a>
          </li>
          <li>
            <a href="#migrate">Migrate ReciMe</a>
          </li>
          <li>
            <a href="https://tbarho.github.io/ovenlovin/" target="_blank" rel="noreferrer">
              Docs
            </a>
          </li>
        </ul>
        <div className="nav-cta">
          {demoUrl ? (
            <a className="btn" href={demoUrl}>
              Try the demo
            </a>
          ) : null}
          {signedIn ? (
            <Link className="btn primary" href="/recipes">
              Open kitchen
            </Link>
          ) : clerkEnabled ? (
            <Link className="btn primary" href="/sign-in">
              Sign in
            </Link>
          ) : (
            <span className="btn">Clerk not configured</span>
          )}
        </div>
      </div>
    </header>
  );
}
