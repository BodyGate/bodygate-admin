import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGPageShellProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
}

export default function BGPageShell({
  children,
  className = "",
  ...props
}: BGPageShellProps) {
  return (
    <div className={`${styles.pageShell} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
