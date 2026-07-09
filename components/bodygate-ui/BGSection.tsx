import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGSectionProps = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export default function BGSection({
  title,
  description,
  actions,
  children,
  className = "",
}: BGSectionProps) {
  return (
    <section className={`${styles.section} ${className}`.trim()}>
      {(title || description || actions) && (
        <div className={styles.sectionHeader}>
          <div>
            {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.headerActions}>{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}
