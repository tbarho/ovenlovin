import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type ButtonVariant = "default" | "secondary" | "tertiary" | "error" | "warning";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "square" | "circle";

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">;

type ButtonCommon = NativeButton & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

export type ButtonProps =
  | (ButtonCommon & {
      svgOnly: true;
      "aria-label": string;
      shape?: ButtonShape;
    })
  | (ButtonCommon & {
      svgOnly?: false;
      "aria-label"?: string;
      shape?: ButtonShape;
    });

/**
 * Shared button primitive. Use Title Case labels.
 * Icon-only buttons set `svgOnly` and must pass `aria-label`.
 */
export function Button({
  variant = "default",
  size = "md",
  loading = false,
  svgOnly,
  shape = "square",
  className,
  disabled,
  type = "button",
  children,
  onClick,
  ...props
}: ButtonProps) {
  const iconOnly = svgOnly === true;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-svg-only={iconOnly || undefined}
      data-shape={iconOnly ? shape : undefined}
      data-loading={loading || undefined}
      className={cx(
        "ds-button",
        `ds-button--${variant}`,
        `ds-button--${size}`,
        iconOnly && "ds-button--svg-only",
        iconOnly && `ds-button--${shape}`,
        loading && "ds-button--loading",
        className
      )}
      onClick={(event) => {
        if (disabled || loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className="ds-button__content" data-hidden={loading || undefined}>
        {children}
      </span>
      {loading ? <span className="ds-button__spinner" aria-hidden="true" /> : null}
    </button>
  );
}
