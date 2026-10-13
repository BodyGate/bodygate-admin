import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStackGap = "sm" | "md" | "lg"

type BGStackProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
  direction?: "column" | "row"
  gap?: BGStackGap
  wrap?: boolean
  spaceBetween?: boolean
}

const gapClass: Record<BGStackGap, string> = {
  sm: styles.stackGapSm,
  md: styles.stackGapMd,
  lg: styles.stackGapLg,
}

export default function BGStack({
  children,
  direction = "column",
  gap = "md",
  wrap = false,
  spaceBetween = false,
  className = "",
  ...props
}: BGStackProps) {
  const classes = [
    styles.stack,
    direction === "row" ? styles.stackRow : "",
    gapClass[gap],
    wrap ? styles.stackWrap : "",
    spaceBetween ? styles.stackBetween : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}
