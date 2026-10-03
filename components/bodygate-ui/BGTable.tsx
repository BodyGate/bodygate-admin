import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGTableProps = ComponentPropsWithoutRef<"table"> & {
  children: ReactNode
  /** Mantiene una larghezza minima: su schermi stretti la tabella scorre in orizzontale invece di comprimere le colonne. */
  wide?: boolean
}

export default function BGTable({
  children,
  wide = false,
  className = "",
  ...props
}: BGTableProps) {
  return (
    <div className={styles.tableFrame}>
      <div className={styles.tableScroll}>
        <table className={`${styles.table} ${wide ? styles.tableWide : ""} ${className}`.trim()} {...props}>
          {children}
        </table>
      </div>
    </div>
  )
}
