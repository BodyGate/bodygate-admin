import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

/** Search-as-you-type picker: wrapper, floating results menu, options and the selected-value chip. */
export function BGLookup({ children }: { children: ReactNode }) {
  return <div className={styles.lookup}>{children}</div>
}

export function BGLookupMenu({ children }: { children: ReactNode }) {
  return <div className={styles.lookupMenu}>{children}</div>
}

export function BGLookupMessage({ children }: { children: ReactNode }) {
  return <div className={styles.lookupMessage}>{children}</div>
}

type BGLookupOptionProps = {
  title: string
  meta?: string | null
  onSelect: () => void
}

export function BGLookupOption({ title, meta, onSelect }: BGLookupOptionProps) {
  return (
    <button type="button" className={styles.lookupOption} onClick={onSelect}>
      <div className={styles.lookupOptionTitle}>{title}</div>
      {meta ? <div className={styles.lookupOptionMeta}>{meta}</div> : null}
    </button>
  )
}

type BGLookupSelectedProps = {
  label: string
  clearLabel?: string
  onClear: () => void
}

export function BGLookupSelected({ label, clearLabel = "Cambia", onClear }: BGLookupSelectedProps) {
  return (
    <div className={styles.lookupSelected}>
      <span>{label}</span>
      <button type="button" className={styles.lookupClear} onClick={onClear}>
        {clearLabel}
      </button>
    </div>
  )
}
