"use client";

import {
  createContext,
  useContext,
  type FieldsetHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import { Hint } from "./label";
import "./ui.css";

type RadioGroupContextValue = {
  name: string;
  required?: boolean;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export type RadioGroupProps = Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "required"> & {
  name: string;
  legend: ReactNode;
  required?: boolean;
  invalid?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
};

/**
 * Exclusive choice group. Native radios inside a fieldset.
 * Legend is a Title Case noun with no colon. Prefer 2 to 6 options.
 */
export function RadioGroup({
  name,
  legend,
  required = false,
  invalid = false,
  disabled,
  hint,
  error,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const ariaInvalid = props["aria-invalid"];
  const isInvalid = invalid || Boolean(error) || ariaInvalid === true || ariaInvalid === "true";
  const description = error ?? hint ?? null;
  const descriptionId = description ? `${name}-describedby` : undefined;
  const describedBy =
    [props["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      {...props}
      disabled={disabled}
      aria-invalid={isInvalid || undefined}
      aria-describedby={describedBy}
      data-slot="radio-group"
      data-invalid={isInvalid || undefined}
      data-required={required || undefined}
      className={cx(
        "ds-radio-group",
        isInvalid && "ds-radio-group--invalid",
        disabled && "ds-radio-group--disabled",
        className
      )}
    >
      <legend className="ds-radio-group__legend" data-slot="radio-group-legend">
        <span className="ds-radio-group__legend-text">{legend}</span>
        {required ? (
          <span className="ds-radio-group__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      <RadioGroupContext.Provider value={{ name, required }}>
        <div className="ds-radio-group__options">{children}</div>
      </RadioGroupContext.Provider>
      {description && descriptionId ? (
        <Hint id={descriptionId} tone={error ? "error" : "default"}>
          {description}
        </Hint>
      ) : null}
    </fieldset>
  );
}

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  value: string;
  children?: ReactNode;
};

/**
 * One option in a RadioGroup. Pass label text as children, or name it
 * with `aria-label`. Hit target is at least 24px. Disabled options are
 * skipped by arrow keys (native radio behavior).
 */
export function Radio({ className, disabled, children, name, required, ...props }: RadioProps) {
  const ctx = useContext(RadioGroupContext);
  const groupName = name ?? ctx?.name;
  const isRequired = required ?? ctx?.required;

  return (
    <label
      data-slot="radio"
      data-disabled={disabled || undefined}
      className={cx("ds-radio", disabled && "ds-radio--disabled", className)}
    >
      <input
        {...props}
        type="radio"
        name={groupName}
        required={isRequired}
        disabled={disabled}
        className="ds-radio__input"
      />
      {children ? <span className="ds-radio__label">{children}</span> : null}
    </label>
  );
}
