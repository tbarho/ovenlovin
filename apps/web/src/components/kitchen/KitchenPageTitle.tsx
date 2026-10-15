"use client";

import { usePathname } from "next/navigation";
import { kitchenPageTitle } from "@/lib/kitchen-nav";

export function KitchenPageTitle() {
  const pathname = usePathname();
  return <p className="kitchen-page-title">{kitchenPageTitle(pathname)}</p>;
}
