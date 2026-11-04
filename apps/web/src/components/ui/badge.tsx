import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type BadgeVariant = "neutral" | "accent" | "ok" | "warn" | "bad";
export type BadgeShape = "pill" | "rounded";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  shape?: BadgeShape;
  icon?: ReactNode;
  children: ReactNode;
};

/**
 * Compact status or label chip. Color is never the only signal:
 * always pass 1 to 2 words of text, and optionally an icon.
 */
export function Badge({
  variant = "neutral",
  shape = "pill",
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      data-slot="badge"
      data-variant={variant}
      data-shape={shape}
      className={cx("ds-badge", `ds-badge--${variant}`, `ds-badge--${shape}`, className)}
    >
      {icon ? (
        <span className="ds-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ds-badge__label">{children}</span>
    </span>
  );
}
