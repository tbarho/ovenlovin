import { withBasePath } from "@/lib/base-path";
import { BRAND_NAME, brandPublicPath } from "@ovenlovin/brand";
import Image from "next/image";

const sizes = {
  nav: { mark: 28, wordmark: { width: 118, height: 36 } },
  hero: { mark: 112, wordmark: { width: 220, height: 56 } },
} as const;

export function BrandWordmark({
  className,
  size = "nav",
}: {
  className?: string;
  size?: keyof typeof sizes;
}): React.ReactElement {
  const { mark, wordmark } = sizes[size];
  const stacked = size === "hero";

  return (
    <span
      className={["inline-flex items-center", stacked ? "flex-col gap-4" : "gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <Image
        src={withBasePath(brandPublicPath.mark)}
        alt={stacked ? BRAND_NAME : ""}
        width={mark}
        height={mark}
        priority
        unoptimized
      />
      <span className="relative inline-flex">
        <Image
          src={withBasePath(brandPublicPath.wordmark)}
          alt={stacked ? "" : BRAND_NAME}
          width={wordmark.width}
          height={wordmark.height}
          className="dark:hidden"
          priority
          unoptimized
        />
        <Image
          src={withBasePath(brandPublicPath.wordmarkDark)}
          alt=""
          width={wordmark.width}
          height={wordmark.height}
          className="hidden dark:block"
          priority
          unoptimized
        />
      </span>
    </span>
  );
}
