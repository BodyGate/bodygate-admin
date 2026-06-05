"use client";

import type { TextareaHTMLAttributes } from "react";

type BGTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
};

export default function BGTextarea({
  label,
  hint,
  className = "",
  id,
  ...props
}: BGTextareaProps) {
  const textareaId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const textarea = (
    <textarea
      id={textareaId}
      className={`bg-textarea bg-form-control ${className}`.trim()}
      {...props}
    />
  );

  if (!label) return textarea;

  return (
    <label className="bg-field bg-form-field" htmlFor={textareaId}>
      <span className="bg-field-label bg-form-label">{label}</span>
      {textarea}
      {hint && <span className="bg-field-hint bg-form-help">{hint}</span>}
    </label>
  );
}
