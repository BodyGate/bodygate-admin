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
      className={`bg-select ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );

  if (!label) return select;

  return (
    <label className="bg-field" htmlFor={selectId}>
      <span className="bg-field-label">{label}</span>
      {select}
      {hint && <span className="bg-field-hint">{hint}</span>}
    </label>
  );
}
