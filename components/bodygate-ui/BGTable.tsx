import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGTableProps = ComponentPropsWithoutRef<"table"> & {
  children: ReactNode
}

export default function BGTable({
  children,
  className = "",
  ...props
}: BGTableProps) {
  return (
    <div className={styles.tableFrame}>
      <div className={styles.tableScroll}>
        <table className={`${styles.table} ${className}`.trim()} {...props}>
          {children}
        </table>
      </div>
    </div>
  )
}
