import styles from "./bodygate-ui.module.css"

type BGEmptyStateProps = {
  title: string
  description?: string
  className?: string
}

export default function BGEmptyState({
  title,
  description,
  className = "",
}: BGEmptyStateProps) {
  return (
    <div className={`${styles.emptyState} ${className}`.trim()}>
      <div className={styles.emptyTitle}>{title}</div>
      {description ? <div className={styles.emptyDescription}>{description}</div> : null}
    </div>
  )
}
