"use client";

import type { SelectHTMLAttributes } from "react";

type BGSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
};

export default function BGSelect({
  label,
  hint,
  className = "",
  id,
  children,
  ...props
}: BGSelectProps) {
  const selectId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const select = (
    <select
      id={selectId}
      className={`bg-select bg-form-control ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );

  if (!label) return select;

  return (
    <label className="bg-field bg-form-field" htmlFor={selectId}>
      <span className="bg-field-label bg-form-label">{label}</span>
      {select}
      {hint && <span className="bg-field-hint bg-form-help">{hint}</span>}
    </label>
  );
}
