import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGFactListProps = {
  items: ReactNode[]
  className?: string
}

export default function BGFactList({ items, className = "" }: BGFactListProps) {
  return (
    <div className={`${styles.guardFacts} ${className}`.trim()}>
      {items.map((item, index) => (
        <span key={index}>{item}</span>
      ))}
    </div>
  )
}
