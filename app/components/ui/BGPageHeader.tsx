"use client";

import type { ReactNode } from "react";

type BGPageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function BGPageHeader({ eyebrow = "BodyGate", title, subtitle, actions }: BGPageHeaderProps) {
  return (
    <header className="bg-page-header">
      <div>
        <div className="bg-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="bg-header-actions">{actions}</div>}
    </header>
  );
}
