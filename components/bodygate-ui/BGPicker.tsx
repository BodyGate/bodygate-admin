import type { ReactNode } from "react"

import BGButton from "./BGButton"
import styles from "./bodygate-ui.module.css"

export function BGPicker({ children }: { children: ReactNode }) {
  return <div className={styles.picker}>{children}</div>
}

export function BGPickerSelected({
  label,
  actionLabel = "Cambia",
  onAction,
}: {
  label: string
  actionLabel?: string
  onAction: () => void
}) {
  return (
    <div className={styles.pickerSelected}>
      <span>{label}</span>
      <BGButton variant="ghost" onClick={onAction}>
        {actionLabel}
      </BGButton>
    </div>
  )
}

export function BGPickerMenu({ children }: { children: ReactNode }) {
  return <div className={styles.pickerMenu}>{children}</div>
}

export function BGPickerMessage({ children }: { children: ReactNode }) {
  return <div className={styles.pickerMessage}>{children}</div>
}

export function BGPickerOption({
  title,
  meta,
  onClick,
}: {
  title: string
  meta?: string | null
  onClick: () => void
}) {
  return (
    <button type="button" className={styles.pickerOption} onClick={onClick}>
      <div className={styles.pickerOptionTitle}>{title}</div>
      {meta && <div className={styles.pickerOptionMeta}>{meta}</div>}
    </button>
  )
}
