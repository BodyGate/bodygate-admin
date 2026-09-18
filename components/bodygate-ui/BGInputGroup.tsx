"use client"

import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGInputGroupProps = {
  children: ReactNode
  className?: string
}

/**
 * Lays out an input alongside trailing actions (e.g. a "Generate" or
 * "Copy" button) without falling back to ad-hoc inline styles.
 */
export default function BGInputGroup({ children, className = "" }: BGInputGroupProps) {
  return <div className={`${styles.inputGroup} ${className}`.trim()}>{children}</div>
}
