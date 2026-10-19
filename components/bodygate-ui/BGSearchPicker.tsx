"use client"

import type { ChangeEvent } from "react"

import BGInput from "./BGInput"
import styles from "./bodygate-ui.module.css"

export type BGSearchPickerItem = {
  id: string
  title: string
  subtitle?: string | null
}

type BGSearchPickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  open: boolean
  loading?: boolean
  items: BGSearchPickerItem[]
  onSelect: (id: string) => void
  loadingLabel?: string
  emptyLabel?: string
  className?: string
}

export default function BGSearchPicker({
  value,
  onChange,
  placeholder,
  open,
  loading = false,
  items,
  onSelect,
  loadingLabel = "Ricerca...",
  emptyLabel = "Nessun risultato.",
  className = "",
}: BGSearchPickerProps) {
  return (
    <div className={`${styles.searchPicker} ${className}`.trim()}>
      <BGInput
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {open ? (
        <div className={styles.searchPickerMenu}>
          {loading ? (
            <div className={styles.searchPickerMessage}>{loadingLabel}</div>
          ) : items.length === 0 ? (
            <div className={styles.searchPickerMessage}>{emptyLabel}</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.searchPickerItem}
                onClick={() => onSelect(item.id)}
              >
                <div className={styles.searchPickerItemTitle}>{item.title}</div>
                {item.subtitle ? (
                  <div className={styles.searchPickerItemSubtitle}>{item.subtitle}</div>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
