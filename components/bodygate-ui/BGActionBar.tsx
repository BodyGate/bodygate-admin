import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGActionBarProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
}

export default function BGActionBar({
  children,
  className = "",
  ...props
}: BGActionBarProps) {
  return (
    <div className={`${styles.actionBar} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
