"use client";

import type { InputHTMLAttributes } from "react";

type BGInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export default function BGInput({
  label,
  hint,
  className = "",
  id,
  ...props
}: BGInputProps) {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const input = (
    <input id={inputId} className={`bg-input bg-form-control ${className}`.trim()} {...props} />
  );

  if (!label) return input;

  return (
    <label className="bg-field bg-form-field" htmlFor={inputId}>
      <span className="bg-field-label bg-form-label">{label}</span>
      {input}
      {hint && <span className="bg-field-hint bg-form-help">{hint}</span>}
    </label>
  );
}
