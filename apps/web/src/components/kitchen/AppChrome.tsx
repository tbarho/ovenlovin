import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { brandPublicPath } from "@ovenlovin/brand";
import { KitchenNav } from "./KitchenNav";

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="nav">
        <div className="wrap nav-inner">
          <Link href="/" className="brand">
            <Image src={brandPublicPath.mark} alt="" width={34} height={34} unoptimized />
            OvenLovin
          </Link>
          <KitchenNav />
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <UserButton /> : null}
        </div>
      </header>
      <div className="wrap kitchen">{children}</div>
    </div>
  );
}
