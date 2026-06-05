"use client";

import type { ReactNode } from "react";

type BGSectionHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function BGSectionHeader({
  title,
  subtitle,
  actions,
}: BGSectionHeaderProps) {
  return (
    <div className="bg-section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="bg-section-actions">{actions}</div>}
    </div>
  );
}
