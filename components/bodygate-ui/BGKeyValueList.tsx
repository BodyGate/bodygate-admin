import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGKeyValueListProps = {
  items: ReactNode[]
  className?: string
}

export default function BGKeyValueList({ items, className = "" }: BGKeyValueListProps) {
  return (
    <div className={`${styles.keyValueList} ${className}`.trim()}>
      {items.map((item, index) => (
        <span key={index}>{item}</span>
      ))}
    </div>
  )
}
