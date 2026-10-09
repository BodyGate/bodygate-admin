import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStackGap = "sm" | "md" | "lg"

type BGStackProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
  gap?: BGStackGap
  direction?: "column" | "row"
}

const gapClass: Record<BGStackGap, string> = {
  sm: styles.stackSm,
  md: "",
  lg: styles.stackLg,
}

export default function BGStack({
  children,
  gap = "md",
  direction = "column",
  className = "",
  ...props
}: BGStackProps) {
  return (
    <div className={`${styles.stack} ${direction === "row" ? styles.stackRow : ""} ${gapClass[gap]} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
