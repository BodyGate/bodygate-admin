import type { ReactNode } from "react"

import BGInput from "./BGInput"
import styles from "./bodygate-ui.module.css"

export type BGSearchPickerOption = { id: string; title: string; note?: string | null }

type BGSearchPickerProps = {
  selected: BGSearchPickerOption | null
  onClear: () => void
  query: string
  onQueryChange: (value: string) => void
  options: BGSearchPickerOption[]
  onSelect: (option: BGSearchPickerOption) => void
  searching?: boolean
  placeholder?: string
  minChars?: number
  clearLabel?: string
  loadingLabel?: ReactNode
  emptyLabel?: ReactNode
}

export default function BGSearchPicker({
  selected,
  onClear,
  query,
  onQueryChange,
  options,
  onSelect,
  searching = false,
  placeholder,
  minChars = 2,
  clearLabel = "Cambia",
  loadingLabel = "Ricerca...",
  emptyLabel = "Nessun risultato.",
}: BGSearchPickerProps) {
  if (selected) {
    return (
      <div className={styles.pickerSelected}>
        <span className={styles.pickerSelectedLabel}>{selected.title}</span>
        <button type="button" className={styles.pickerClear} onClick={onClear}>{clearLabel}</button>
      </div>
    )
  }

  return (
    <div className={styles.picker}>
      <BGInput value={query} onChange={event => onQueryChange(event.target.value)} placeholder={placeholder} />
      {query.trim().length >= minChars ? (
        <div className={styles.pickerMenu}>
          {searching ? (
            <div className={styles.pickerMessage}>{loadingLabel}</div>
          ) : options.length === 0 ? (
            <div className={styles.pickerMessage}>{emptyLabel}</div>
          ) : (
            options.map(option => (
              <button key={option.id} type="button" className={styles.pickerOption} onClick={() => onSelect(option)}>
                <div className={styles.pickerOptionTitle}>{option.title}</div>
                {option.note ? <div className={styles.pickerOptionNote}>{option.note}</div> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
