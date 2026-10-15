import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGActionBarProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
  align?: "start" | "end"
}

export default function BGActionBar({
  children,
  align = "end",
  className = "",
  ...props
}: BGActionBarProps) {
  return (
    <div className={`${styles.actionBar} ${align === "start" ? styles.actionBarStart : ""} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
