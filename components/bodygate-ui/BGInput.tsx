"use client"

import type { ComponentPropsWithoutRef } from "react"

import styles from "./bodygate-ui.module.css"

export default function BGInput({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return <input className={`${styles.input} ${className}`.trim()} {...props} />
}
