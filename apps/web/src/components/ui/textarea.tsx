import type { TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import "./ui.css";

export type TextareaResize = "vertical" | "none";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  resize?: TextareaResize;
};

/**
 * Native multiline field. Shares Input border, focus, disabled, and
 * invalid styles. Resize is vertical by default; pass `none` to lock it.
 */
export function Textarea({
  invalid = false,
  resize = "vertical",
  className,
  disabled,
  ...props
}: TextareaProps) {
  const ariaInvalid = props["aria-invalid"];
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  return (
    <textarea
      {...props}
      disabled={disabled}
      aria-invalid={isInvalid || undefined}
      data-slot="textarea"
      data-invalid={isInvalid || undefined}
      data-resize={resize}
      className={cx(
        "ds-textarea",
        `ds-textarea--${resize}`,
        isInvalid && "ds-textarea--invalid",
        className
      )}
    />
  );
}
