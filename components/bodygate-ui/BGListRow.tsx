import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGListRowProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  compact?: boolean
}

export default function BGListRow({
  title,
  meta,
  actions,
  compact = false,
  className = "",
  ...props
}: BGListRowProps) {
  return (
    <div
      className={`${styles.listRow} ${compact ? styles.listRowCompact : ""} ${className}`.trim()}
      {...props}
    >
      <div>
        <div className={styles.listRowTitle}>{title}</div>
        {meta ? <div className={styles.listRowMeta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.listRowActions}>{actions}</div> : null}
    </div>
  )
}
