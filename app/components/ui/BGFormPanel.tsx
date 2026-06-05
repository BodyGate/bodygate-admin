"use client";

import type { ReactNode } from "react";

type BGFormPanelProps = {
  children: ReactNode;
  className?: string;
  premium?: boolean;
};

export default function BGFormPanel({
  children,
  className = "",
  premium = false,
}: BGFormPanelProps) {
  return (
    <section
      className={`bg-card ${premium ? "bg-card-premium" : ""} bg-form-panel ${className}`.trim()}
    >
      {children}
    </section>
  );
}
