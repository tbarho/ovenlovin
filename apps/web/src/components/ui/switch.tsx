import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type SwitchSize = "sm" | "md";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  size?: SwitchSize;
  children?: ReactNode;
};

/**
 * Immediate boolean setting. Native checkbox with `role="switch"`.
 * Sizes are small (`sm`) and medium (`md`). Provide an accessible name
 * via children or `aria-label`.
 */
export function Switch({ size = "md", className, disabled, children, ...props }: SwitchProps) {
  return (
    <label
      data-slot="switch"
      data-size={size}
      data-disabled={disabled || undefined}
      className={cx(
        "ds-switch",
        `ds-switch--${size}`,
        disabled && "ds-switch--disabled",
        className
      )}
    >
      <input
        {...props}
        type="checkbox"
        role="switch"
        disabled={disabled}
        className="ds-switch__input"
      />
      {children ? <span className="ds-switch__label">{children}</span> : null}
    </label>
  );
}
