import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStatGridProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
}

export default function BGStatGrid({
  children,
  className = "",
  ...props
}: BGStatGridProps) {
  return (
    <div className={`${styles.statGrid} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
