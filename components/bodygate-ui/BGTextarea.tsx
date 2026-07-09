"use client"

import type { ComponentPropsWithoutRef } from "react"

import styles from "./bodygate-ui.module.css"

export default function BGTextarea({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={`${styles.textarea} ${className}`.trim()} {...props} />
}
