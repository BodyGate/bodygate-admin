"use client"

import type { ComponentPropsWithoutRef } from "react"

import styles from "./bodygate-ui.module.css"

export default function BGSelect({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return <select className={`${styles.input} ${className}`.trim()} {...props} />
}
