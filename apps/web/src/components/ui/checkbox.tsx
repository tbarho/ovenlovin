"use client";

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  indeterminate?: boolean;
  children?: ReactNode;
};

/**
 * Native checkbox. Pass label text as children, or name it with
 * `aria-label` / an external Label. Hit target is at least 24px.
 */
export function Checkbox({
  indeterminate = false,
  className,
  disabled,
  children,
  ...props
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label
      data-slot="checkbox"
      data-disabled={disabled || undefined}
      data-indeterminate={indeterminate || undefined}
      className={cx("ds-checkbox", disabled && "ds-checkbox--disabled", className)}
    >
      <input
        {...props}
        ref={inputRef}
        type="checkbox"
        disabled={disabled}
        className="ds-checkbox__input"
      />
      {children ? <span className="ds-checkbox__label">{children}</span> : null}
    </label>
  );
}
