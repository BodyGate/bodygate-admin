import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGPickerSelectedProps = { label: string; actionLabel?: string; onClear: () => void }

export function BGPickerSelected({ label, actionLabel = "Cambia", onClear }: BGPickerSelectedProps) {
  return (
    <div className={styles.pickerSelected}>
      <span>{label}</span>
      <button type="button" className={styles.pickerLink} onClick={onClear}>{actionLabel}</button>
    </div>
  )
}

export function BGPickerAnchor({ children }: { children: ReactNode }) {
  return <div className={styles.pickerAnchor}>{children}</div>
}

export function BGPickerMenu({ children }: { children: ReactNode }) {
  return <div className={styles.pickerMenu}>{children}</div>
}

export function BGPickerNote({ children }: { children: ReactNode }) {
  return <div className={styles.pickerNote}>{children}</div>
}

export function BGPickerOption({ title, meta, onSelect }: { title: string; meta?: string | null; onSelect: () => void }) {
  return (
    <button type="button" className={styles.pickerOption} onClick={onSelect}>
      <div className={styles.pickerOptionTitle}>{title}</div>
      {meta ? <div className={styles.pickerOptionMeta}>{meta}</div> : null}
    </button>
  )
}
