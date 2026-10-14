import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { brandPublicPath } from "@ovenlovin/brand";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { KitchenNav } from "./KitchenNav";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="OvenLovin">
      <Image src={brandPublicPath.mark} alt="" width={34} height={34} unoptimized />
      {compact ? null : <span className="brand-wordmark">OvenLovin</span>}
    </Link>
  );
}

function Account() {
  return (
    <div className="nav-user">
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <UserButton /> : null}
    </div>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const demo = isDemoModeEnabled();
  return (
    <div className="shell kitchen-shell">
      {demo ? <DemoBanner /> : null}
      <aside className="kitchen-sidebar">
        <Brand />
        <KitchenNav variant="sidebar" />
        <Account />
      </aside>
      <header className="nav kitchen-topbar">
        <div className="wrap nav-inner">
          <Brand />
          <KitchenNav />
          <Account />
        </div>
      </header>
      <div className="wrap kitchen">{children}</div>
      <KitchenNav variant="tabs" />
    </div>
  );
}
