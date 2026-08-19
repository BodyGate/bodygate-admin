import type { ReactNode } from "react"

export default function BGDataTable({ children, minWidth = 900, className = "" }: { children: ReactNode; minWidth?: number; className?: string }) {
  return <div className={`bg-table-wrap ${className}`.trim()}><table className="bg-table" style={{ minWidth }}>{children}</table></div>
}
