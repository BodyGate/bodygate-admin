"use client";

import type { ReactNode } from "react";

type BGContentGridProps = {
  children: ReactNode;
  className?: string;
};

export default function BGContentGrid({ children, className = "" }: BGContentGridProps) {
  return <div className={`bg-content-grid ${className}`.trim()}>{children}</div>;
}
