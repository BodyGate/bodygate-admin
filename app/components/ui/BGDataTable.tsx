"use client";

import type { ReactNode } from "react";

type BGDataTableProps = {
  children: ReactNode;
  minWidth?: number;
  className?: string;
};

export default function BGDataTable({
  children,
  minWidth = 900,
  className = "",
}: BGDataTableProps) {
  return (
    <div className={`bg-table-wrap ${className}`.trim()}>
      <table className="bg-table" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
