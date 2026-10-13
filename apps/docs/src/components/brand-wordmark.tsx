import { withBasePath } from "@/lib/base-path";
import { BRAND_NAME, brandPublicPath } from "@ovenlovin/brand";
import Image from "next/image";

const sizes = {
  nav: { width: 132, height: 40 },
  hero: { width: 280, height: 85 },
} as const;

export function BrandWordmark({
  className,
  size = "nav",
}: {
  className?: string;
  size?: keyof typeof sizes;
}): React.ReactElement {
  const { width, height } = sizes[size];

  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      <Image
        src={withBasePath(brandPublicPath.logo)}
        alt={BRAND_NAME}
        width={width}
        height={height}
        className="dark:hidden"
        priority
        unoptimized
      />
      <Image
        src={withBasePath(brandPublicPath.logoDark)}
        alt=""
        width={width}
        height={height}
        className="hidden dark:block"
        priority
        unoptimized
      />
    </span>
  );
}
