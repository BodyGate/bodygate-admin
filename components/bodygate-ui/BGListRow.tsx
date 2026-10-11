import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGListRowProps = Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  variant?: "default" | "soft"
}

export default function BGListRow({
  title,
  meta,
  actions,
  variant = "default",
  className = "",
  ...props
}: BGListRowProps) {
  return (
    <div
      className={`${styles.listRow} ${variant === "soft" ? styles.listRowSoft : ""} ${className}`.trim()}
      {...props}
    >
      <div className={styles.listRowText}>
        <div className={styles.listRowTitle}>{title}</div>
        {meta ? <div className={styles.listRowMeta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.listRowActions}>{actions}</div> : null}
    </div>
  )
}
