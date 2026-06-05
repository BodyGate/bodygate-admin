"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type BGActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
};

export default function BGActionLink({
  href,
  children,
  variant = "secondary",
  className = "",
}: BGActionLinkProps) {
  return (
    <Link
      className={`bg-action-link bg-action-link-${variant} ${className}`.trim()}
      href={href}
    >
      {children}
    </Link>
  );
}
