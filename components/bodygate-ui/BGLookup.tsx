"use client"

import BGInput from "./BGInput"
import styles from "./bodygate-ui.module.css"

export type BGLookupOption = {
  id: string
  title: string
  subtitle?: string | null
}

type BGLookupProps = {
  selectedLabel?: string | null
  onClear: () => void
  query: string
  onQueryChange: (value: string) => void
  placeholder?: string
  open: boolean
  loading?: boolean
  options: BGLookupOption[]
  onPick: (option: BGLookupOption) => void
  clearLabel?: string
  loadingLabel?: string
  emptyLabel?: string
}

export default function BGLookup({
  selectedLabel,
  onClear,
  query,
  onQueryChange,
  placeholder,
  open,
  loading = false,
  options,
  onPick,
  clearLabel = "Cambia",
  loadingLabel = "Ricerca...",
  emptyLabel = "Nessun risultato.",
}: BGLookupProps) {
  if (selectedLabel) {
    return (
      <div className={styles.lookupSelected}>
        <span className={styles.lookupSelectedLabel}>{selectedLabel}</span>
        <button type="button" className={styles.lookupClear} onClick={onClear}>
          {clearLabel}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.lookup}>
      <BGInput value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder={placeholder} />
      {open ? (
        <div className={styles.lookupMenu}>
          {loading ? (
            <div className={styles.lookupMessage}>{loadingLabel}</div>
          ) : options.length === 0 ? (
            <div className={styles.lookupMessage}>{emptyLabel}</div>
          ) : (
            options.map((option) => (
              <button key={option.id} type="button" className={styles.lookupOption} onClick={() => onPick(option)}>
                <div className={styles.lookupOptionTitle}>{option.title}</div>
                {option.subtitle ? <div className={styles.lookupOptionSubtitle}>{option.subtitle}</div> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
