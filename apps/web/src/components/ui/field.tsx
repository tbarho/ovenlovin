import {
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import { Hint, Label } from "./label";
import "./ui.css";

type FieldControlProps = {
  id?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
};

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<FieldControlProps>;
};

/**
 * Label + control + helper/error. Wires `htmlFor` / `id` and
 * `aria-describedby`. Error replaces helper and marks the control invalid.
 * Use a Title Case noun for the label. Skip RadioGroup (it has its own legend).
 */
export function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  className,
  children,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const childId = isValidElement(children) ? children.props.id : undefined;
  const controlId = htmlFor ?? childId ?? generatedId;
  const description = error ?? hint ?? null;
  const descriptionId = description ? `${controlId}-describedby` : undefined;
  const invalid = Boolean(error);
  const describedBy =
    [isValidElement(children) ? children.props["aria-describedby"] : undefined, descriptionId]
      .filter(Boolean)
      .join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: childId ?? controlId,
        invalid: invalid || children.props.invalid,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div
      {...props}
      data-slot="field"
      data-invalid={invalid || undefined}
      data-required={required || undefined}
      className={cx("ds-field", invalid && "ds-field--invalid", className)}
    >
      <Label htmlFor={controlId} required={required}>
        {label}
      </Label>
      {control}
      {description && descriptionId ? (
        <Hint id={descriptionId} tone={error ? "error" : "default"}>
          {description}
        </Hint>
      ) : null}
    </div>
  );
}
