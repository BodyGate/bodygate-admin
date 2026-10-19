"use client"

import styles from "./bodygate-ui.module.css"

type BGSelectedItemProps = {
  label: string
  actionLabel: string
  onAction: () => void
  className?: string
}

export default function BGSelectedItem({
  label,
  actionLabel,
  onAction,
  className = "",
}: BGSelectedItemProps) {
  return (
    <div className={`${styles.selectedItem} ${className}`.trim()}>
      <span className={styles.selectedItemLabel}>{label}</span>
      <button type="button" className={styles.selectedItemAction} onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}
