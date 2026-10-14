"use client"

import type { ComponentPropsWithoutRef } from "react"

import styles from "./bodygate-ui.module.css"

type BGInputProps = ComponentPropsWithoutRef<"input"> & {
  compact?: boolean
}

export default function BGInput({
  compact = false,
  className = "",
  ...props
}: BGInputProps) {
  const classes = `${styles.input} ${compact ? styles.inputCompact : ""} ${className}`.trim()
  return <input className={classes} {...props} />
}
