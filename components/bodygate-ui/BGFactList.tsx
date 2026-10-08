import type { ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGFactListProps = {
  items: ReactNode[]
  className?: string
}

export default function BGFactList({ items, className = "" }: BGFactListProps) {
  return (
    <ul className={`${styles.factList} ${className}`.trim()}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}
