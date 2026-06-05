"use client";

import type { ReactNode } from "react";

type BGCardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "soft" | "premium" | "danger" | "success" | "warning";
};

export default function BGCard({ children, className = "", variant = "default" }: BGCardProps) {
  return <section className={`bg-card bg-card-${variant} ${className}`}>{children}</section>;
}
