import type { ReactNode } from "react"

import BGCard from "./BGCard"
import styles from "./bodygate-ui.module.css"

type BGCenteredNoticeProps = {
  eyebrow?: string
  title: string
  description?: string
  details?: ReactNode[]
  actions?: ReactNode
  variant?: "premium" | "danger"
}

export default function BGCenteredNotice({
  eyebrow = "BodyGate",
  title,
  description,
  details,
  actions,
  variant = "premium",
}: BGCenteredNoticeProps) {
  return (
    <main className={styles.centeredStage}>
      <BGCard variant={variant} className={styles.centeredNotice}>
        <p className={`${styles.eyebrow} ${variant === "danger" ? styles.eyebrowDanger : ""}`.trim()}>
          {eyebrow}
        </p>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
        {details?.length ? (
          <div className={styles.centeredNoticeMeta}>
            {details.map((detail, index) => (
              <span key={index}>{detail}</span>
            ))}
          </div>
        ) : null}
        {actions}
      </BGCard>
    </main>
  )
}
