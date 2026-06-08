"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type BGQuickActionCardProps = {
  href: string;
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
};

export default function BGQuickActionCard({
  href,
  title,
  description,
  icon = "↗",
  className = "",
}: BGQuickActionCardProps) {
  return (
    <Link
      className={`bg-action-card ${className}`.trim()}
      href={href}
      aria-label={`${title}: ${description}`}
    >
      <span className="bg-action-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="bg-action-copy">
        <span className="bg-action-title">{title}</span>
        <span className="bg-action-description">{description}</span>
      </span>
      <span className="bg-action-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
