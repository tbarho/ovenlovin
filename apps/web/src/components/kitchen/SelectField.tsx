"use client";

import type { SelectHTMLAttributes } from "react";

type SelectFieldProps = {
  label?: string;
  hint?: string;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ label, hint, id, className, children, ...props }: SelectFieldProps) {
  const selectId = id ?? props.name;

  return (
    <label className={`select-field${className ? ` ${className}` : ""}`} htmlFor={selectId}>
      {label ? <span className="field-label">{label}</span> : null}
      <span className="select-control">
        <select id={selectId} {...props}>
          {children}
        </select>
        <span className="select-chevron" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
