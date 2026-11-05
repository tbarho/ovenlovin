import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";
import "./ui.css";

export type InputSize = "sm" | "md" | "lg";
export type InputType = "text" | "email" | "password" | "search" | "number" | "url" | "tel";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> & {
  size?: InputSize;
  type?: InputType;
  invalid?: boolean;
};

/**
 * Native text field. Heights match Button (sm/md/lg = 32/36/40).
 * Skip prefix/suffix slots; compose those at the call site if needed.
 */
export function Input({
  size = "md",
  type = "text",
  invalid = false,
  className,
  disabled,
  ...props
}: InputProps) {
  const ariaInvalid = props["aria-invalid"];
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  return (
    <input
      {...props}
      type={type}
      disabled={disabled}
      aria-invalid={isInvalid || undefined}
      data-slot="input"
      data-size={size}
      data-invalid={isInvalid || undefined}
      className={cx("ds-input", `ds-input--${size}`, isInvalid && "ds-input--invalid", className)}
    />
  );
}
