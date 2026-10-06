import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGSplitGridProps = {
  children: ReactNode
  className?: string
}

export default function BGSplitGrid({ children, className = "" }: BGSplitGridProps) {
  return <div className={`${styles.splitGrid} ${className}`.trim()}>{children}</div>
}
