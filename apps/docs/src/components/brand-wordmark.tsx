/**
 * Text wordmark until the shared OvenLovin logo lands on main
 * (packages/brand or apps/web/public/brand). Swap the span for an
 * <img> / next/image once that asset exists.
 */
export function BrandWordmark({ className }: { className?: string }): React.ReactElement {
  return (
    <span
      className={["inline-flex items-center font-semibold tracking-tight", className]
        .filter(Boolean)
        .join(" ")}
    >
      OvenLovin
    </span>
  );
}
