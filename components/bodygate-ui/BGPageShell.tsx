import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGPageShellProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
  centered?: boolean
}

export default function BGPageShell({
  children,
  centered = false,
  className = "",
  ...props
}: BGPageShellProps) {
  return (
    <div className={`${styles.pageShell} ${centered ? styles.pageShellCentered : ""} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
