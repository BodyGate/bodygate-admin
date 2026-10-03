import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStatGridProps = {
  children: ReactNode
  className?: string
}

export default function BGStatGrid({ children, className = "" }: BGStatGridProps) {
  return <div className={`${styles.statGrid} ${className}`.trim()}>{children}</div>
}
