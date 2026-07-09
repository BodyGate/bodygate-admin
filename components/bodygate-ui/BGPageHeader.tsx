import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGPageHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export default function BGPageHeader({
  eyebrow = "BodyGate",
  title,
  subtitle,
  actions,
  className = "",
}: BGPageHeaderProps) {
  return (
    <header className={`${styles.pageHeader} ${className}`.trim()}>
      <div className={styles.headerText}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  )
}
