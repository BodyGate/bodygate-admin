import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGStatusTone = "neutral" | "success" | "danger" | "warning" | "info"

type BGStatusBadgeProps = {
  children: ReactNode
  tone?: BGStatusTone
  className?: string
}

const toneClass: Record<BGStatusTone, string> = {
  neutral: styles.badgeNeutral,
  success: styles.badgeSuccess,
  danger: styles.badgeDanger,
  warning: styles.badgeWarning,
  info: styles.badgeInfo,
}

export default function BGStatusBadge({
  children,
  tone = "neutral",
  className = "",
}: BGStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${toneClass[tone]} ${className}`.trim()}>
      {children}
    </span>
  )
}
