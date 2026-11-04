import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  children: ReactNode;
};

/**
 * Form label. Associate with a control via `htmlFor` or by wrapping.
 * Use Title Case for short labels.
 */
export function Label({ required = false, className, children, ...props }: LabelProps) {
  return (
    <label
      {...props}
      data-slot="label"
      data-required={required || undefined}
      className={cx("ds-label", className)}
    >
      <span className="ds-label__text">{children}</span>
      {required ? (
        <span className="ds-label__required" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export type HintTone = "default" | "error";

export type HintProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: HintTone;
  children: ReactNode;
};

/**
 * Helper or error text. Place as a sibling of Input / Textarea and
 * point `aria-describedby` at it when it describes a control.
 */
export function Hint({ tone = "default", className, children, ...props }: HintProps) {
  return (
    <p
      {...props}
      data-slot="hint"
      data-tone={tone}
      className={cx("ds-hint", `ds-hint--${tone}`, className)}
    >
      {children}
    </p>
  );
}
