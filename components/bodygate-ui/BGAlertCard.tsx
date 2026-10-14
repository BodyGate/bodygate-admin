import type { ReactNode } from "react"

import BGCard from "./BGCard"
import styles from "./bodygate-ui.module.css"

type BGAlertCardTone = "danger" | "warning" | "success"

type BGAlertCardProps = {
  title: string
  tone?: BGAlertCardTone
  children?: ReactNode
  action?: ReactNode
  className?: string
}

const toneClass: Record<BGAlertCardTone, string> = {
  danger: styles.alertCardTitleDanger,
  warning: styles.alertCardTitleWarning,
  success: styles.alertCardTitleSuccess,
}

export default function BGAlertCard({
  title,
  tone = "warning",
  children,
  action,
  className = "",
}: BGAlertCardProps) {
  return (
    <BGCard variant={tone} className={`${styles.alertCard} ${className}`.trim()}>
      <div className={styles.alertCardBody}>
        <div className={`${styles.alertCardTitle} ${toneClass[tone]}`}>{title}</div>
        {children}
      </div>
      {action ? <div className={styles.alertCardAction}>{action}</div> : null}
    </BGCard>
  )
}
