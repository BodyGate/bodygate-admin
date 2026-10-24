import styles from "./bodygate-ui.module.css"

type BGDetailListProps = {
  items: string[]
  className?: string
}

export default function BGDetailList({ items, className = "" }: BGDetailListProps) {
  return (
    <ul className={`${styles.detailList} ${className}`.trim()}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
