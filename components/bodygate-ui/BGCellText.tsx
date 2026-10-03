import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCellTextProps = {
  children: ReactNode
  variant?: "mono" | "secondary"
}

export default function BGCellText({ children, variant = "secondary" }: BGCellTextProps) {
  return <div className={variant === "mono" ? styles.mono : styles.cellSecondary}>{children}</div>
}
