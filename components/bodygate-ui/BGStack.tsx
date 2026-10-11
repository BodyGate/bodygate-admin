import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStackGap = "xs" | "sm" | "md" | "lg"

type BGStackProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
  direction?: "row" | "column"
  gap?: BGStackGap
  wrap?: boolean
  align?: "start" | "center"
  justify?: "start" | "between"
}

const gapClass: Record<BGStackGap, string> = {
  xs: styles.stackGapXs,
  sm: styles.stackGapSm,
  md: styles.stackGapMd,
  lg: styles.stackGapLg,
}

export default function BGStack({
  children,
  direction = "column",
  gap = "md",
  wrap = false,
  align,
  justify,
  className = "",
  ...props
}: BGStackProps) {
  const classes = [
    styles.stack,
    direction === "row" ? styles.stackRow : "",
    gapClass[gap],
    wrap ? styles.stackWrap : "",
    align === "start" ? styles.stackAlignStart : align === "center" ? styles.stackAlignCenter : "",
    justify === "between" ? styles.stackJustifyBetween : "",
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
