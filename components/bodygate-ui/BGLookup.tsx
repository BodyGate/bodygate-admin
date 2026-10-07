import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGLookupProps = {
  children: ReactNode
  className?: string
}

/** Wrapper for an input with a dropdown of results (search-and-pick fields). */
export function BGLookup({ children, className = "" }: BGLookupProps) {
  return <div className={`${styles.lookup} ${className}`.trim()}>{children}</div>
}

type BGLookupSelectedProps = {
  label: string
  onClear: () => void
  clearLabel?: string
}

/** Read-only display of the chosen item with a button to clear the choice. */
export function BGLookupSelected({ label, onClear, clearLabel = "Cambia" }: BGLookupSelectedProps) {
  return (
    <div className={styles.lookupSelected}>
      <span>{label}</span>
      <button type="button" className={styles.lookupClear} onClick={onClear}>
        {clearLabel}
      </button>
    </div>
  )
}

export function BGLookupMenu({ children }: { children: ReactNode }) {
  return <div className={styles.lookupMenu}>{children}</div>
}

export function BGLookupMessage({ children }: { children: ReactNode }) {
  return <div className={styles.lookupMessage}>{children}</div>
}

type BGLookupOptionProps = {
  label: string
  meta?: string | null
  onSelect: () => void
}

export function BGLookupOption({ label, meta, onSelect }: BGLookupOptionProps) {
  return (
    <button type="button" className={styles.lookupOption} onClick={onSelect}>
      <div className={styles.lookupOptionLabel}>{label}</div>
      {meta ? <div className={styles.lookupOptionMeta}>{meta}</div> : null}
    </button>
  )
}
