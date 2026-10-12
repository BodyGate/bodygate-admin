"use client"

import BGInput from "./BGInput"
import styles from "./bodygate-ui.module.css"

export type BGSearchPickerOption = {
  id: string
  label: string
  detail?: string | null
}

type BGSearchPickerProps = {
  query: string
  onQueryChange: (value: string) => void
  placeholder?: string
  selectedLabel?: string | null
  onClear: () => void
  clearLabel?: string
  menuOpen: boolean
  loading?: boolean
  loadingLabel?: string
  emptyLabel?: string
  options: BGSearchPickerOption[]
  onPick: (id: string) => void
}

export default function BGSearchPicker({
  query,
  onQueryChange,
  placeholder,
  selectedLabel,
  onClear,
  clearLabel = "Cambia",
  menuOpen,
  loading = false,
  loadingLabel = "Ricerca...",
  emptyLabel = "Nessun risultato.",
  options,
  onPick,
}: BGSearchPickerProps) {
  if (selectedLabel) {
    return (
      <div className={styles.pickerSelected}>
        <span>{selectedLabel}</span>
        <button type="button" className={styles.pickerClear} onClick={onClear}>
          {clearLabel}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.picker}>
      <BGInput
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
      />
      {menuOpen ? (
        <div className={styles.pickerMenu}>
          {loading ? (
            <div className={styles.pickerMessage}>{loadingLabel}</div>
          ) : options.length === 0 ? (
            <div className={styles.pickerMessage}>{emptyLabel}</div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.pickerOption}
                onClick={() => onPick(option.id)}
              >
                {option.label}
                {option.detail ? (
                  <span className={styles.pickerOptionDetail}>{option.detail}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
