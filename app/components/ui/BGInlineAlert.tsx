"use client";

import type { ReactNode } from "react";

type BGInlineAlertProps = {
  children: ReactNode;
  tone?: "error" | "info";
  className?: string;
};

export default function BGInlineAlert({
  children,
  tone = "error",
  className = "",
}: BGInlineAlertProps) {
  return (
    <div className={`bg-inline-alert bg-inline-alert-${tone} ${className}`.trim()}>
      {children}
    </div>
  );
}
