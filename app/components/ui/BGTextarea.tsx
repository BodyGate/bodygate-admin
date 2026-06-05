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
      className={`bg-textarea ${className}`.trim()}
      {...props}
    />
  );

  if (!label) return textarea;

  return (
    <label className="bg-field" htmlFor={textareaId}>
      <span className="bg-field-label">{label}</span>
      {textarea}
      {hint && <span className="bg-field-hint">{hint}</span>}
    </label>
  );
}
