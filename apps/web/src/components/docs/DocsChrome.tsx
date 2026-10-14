import Image from "next/image";
import Link from "next/link";
import { brandPublicPath } from "@ovenlovin/brand";

export function DocsChrome({
  children,
  current,
}: {
  children: React.ReactNode;
  current: "index" | "connect";
}) {
  return (
    <div className="shell">
      <header className="nav">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="OvenLovin">
            <Image src={brandPublicPath.mark} alt="" width={34} height={34} unoptimized />
            OvenLovin
          </Link>
          <ul className="nav-links">
            <li>
              <Link href="/docs" aria-current={current === "index" ? "page" : undefined}>
                Docs
              </Link>
            </li>
            <li>
              <Link
                href="/docs/connect-your-agent"
                aria-current={current === "connect" ? "page" : undefined}
              >
                Connect your agent
              </Link>
            </li>
            <li>
              <a href="/llms.txt">llms.txt</a>
            </li>
            <li>
              <a href="https://tbarho.github.io/ovenlovin/" target="_blank" rel="noreferrer">
                Full reference
              </a>
            </li>
          </ul>
          <div className="nav-cta">
            <Link className="btn primary" href="/#connect">
              Get an API key
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="section">
          <div className="wrap docs-page">{children}</div>
        </section>
      </main>
    </div>
  );
}
