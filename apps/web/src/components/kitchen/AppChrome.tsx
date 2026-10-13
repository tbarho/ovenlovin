import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { brandPublicPath } from "@ovenlovin/brand";
import { KitchenNav } from "./KitchenNav";

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell kitchen-shell">
      <header className="nav kitchen-topbar">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="OvenLovin">
            <Image src={brandPublicPath.mark} alt="" width={34} height={34} unoptimized />
            <span className="brand-wordmark">OvenLovin</span>
            <span className="brand-wordmark-short" aria-hidden="true">
              Oven
            </span>
          </Link>
          <KitchenNav />
          <div className="nav-user">
            {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <UserButton /> : null}
          </div>
        </div>
      </header>
      <div className="wrap kitchen">{children}</div>
      <KitchenNav variant="tabs" />
    </div>
  );
}
