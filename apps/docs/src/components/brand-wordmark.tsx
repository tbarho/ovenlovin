import { withBasePath } from "@/lib/base-path";
import { BRAND_NAME, brandPublicPath } from "@ovenlovin/brand";
import Image from "next/image";

const sizes = {
  nav: { mark: 28, word: "text-[1.5rem] leading-none tracking-[0.01em]" },
  hero: { mark: 112, word: "text-5xl leading-none sm:text-6xl" },
} as const;

export function BrandWordmark({
  className,
  size = "nav",
}: {
  className?: string;
  size?: keyof typeof sizes;
}): React.ReactElement {
  const { mark, word } = sizes[size];
  const stacked = size === "hero";

  return (
    <span
      className={["inline-flex items-center", stacked ? "flex-col gap-4" : "gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <Image
        src={withBasePath(brandPublicPath.mark)}
        alt=""
        width={mark}
        height={mark}
        priority
        unoptimized
      />
      <span className={`font-display font-normal tracking-normal ${word}`}>{BRAND_NAME}</span>
    </span>
  );
}
