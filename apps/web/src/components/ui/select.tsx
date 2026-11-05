import type { SelectHTMLAttributes } from "react";
import { cx } from "./cx";
import "./ui.css";

export type SelectSize = "sm" | "md" | "lg";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: SelectSize;
  invalid?: boolean;
  placeholder?: string;
};

/**
 * Native select. Heights match Input / Button (sm/md/lg = 32/36/40).
 * Pass `placeholder` for a disabled hidden empty option ("Select ...").
 * Custom popover menus are out of scope.
 */
export function Select({
  size = "md",
  invalid = false,
  placeholder,
  className,
  disabled,
  children,
  ...props
}: SelectProps) {
  const ariaInvalid = props["aria-invalid"];
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  return (
    <span
      data-slot="select-wrap"
      data-size={size}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      className={cx(
        "ds-select-wrap",
        `ds-select-wrap--${size}`,
        isInvalid && "ds-select-wrap--invalid",
        disabled && "ds-select-wrap--disabled"
      )}
    >
      <select
        {...props}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        data-slot="select"
        data-size={size}
        data-invalid={isInvalid || undefined}
        className={cx(
          "ds-select",
          `ds-select--${size}`,
          isInvalid && "ds-select--invalid",
          className
        )}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <span className="ds-select__chevron" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M4.2 6.2 8 10l3.8-3.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}
