import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGGridProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
}

export default function BGGrid({ children, className = "", ...props }: BGGridProps) {
  return (
    <div className={`${styles.grid} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
