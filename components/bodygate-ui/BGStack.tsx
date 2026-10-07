import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStackProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode
  direction?: "column" | "row"
  spread?: boolean
}

export default function BGStack({
  children,
  direction = "column",
  spread = false,
  className = "",
  ...props
}: BGStackProps) {
  const classes = [
    direction === "row" ? styles.stackRow : styles.stack,
    direction === "row" && spread ? styles.stackBetween : "",
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
