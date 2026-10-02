import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGTableProps = ComponentPropsWithoutRef<"table"> & {
  children: ReactNode
  minWidth?: number
}

export default function BGTable({
  children,
  className = "",
  minWidth,
  style,
  ...props
}: BGTableProps) {
  return (
    <div className={styles.tableFrame}>
      <div className={styles.tableScroll}>
        <table
          className={`${styles.table} ${className}`.trim()}
          style={minWidth ? { minWidth, ...style } : style}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  )
}
