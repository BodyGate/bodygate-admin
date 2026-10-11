"use client"

import type { ComponentPropsWithoutRef } from "react"

import styles from "./bodygate-ui.module.css"

type BGInputProps = ComponentPropsWithoutRef<"input"> & {
  compact?: "sm" | "md"
}

export default function BGInput({
  className = "",
  compact,
  ...props
}: BGInputProps) {
  const compactClass = compact === "sm" ? styles.inputSm : compact === "md" ? styles.inputMd : ""
  return <input className={`${styles.input} ${compactClass} ${className}`.trim()} {...props} />
}
