import styles from "./bodygate-ui.module.css"

type BGStatTone = "neutral" | "red" | "green" | "yellow" | "blue"

type BGStatCardProps = {
  label: string
  value: string | number
  note?: string
  tone?: BGStatTone
  className?: string
}

const toneClass: Record<BGStatTone, string> = {
  neutral: "",
  red: styles.toneRed,
  green: styles.toneGreen,
  yellow: styles.toneYellow,
  blue: styles.toneBlue,
}

export default function BGStatCard({
  label,
  value,
  note,
  tone = "neutral",
  className = "",
}: BGStatCardProps) {
  return (
    <article className={`${styles.statCard} ${toneClass[tone]} ${className}`.trim()}>
      <div>
        <div className={styles.label}>{label}</div>
        <div className={styles.statValue}>{value}</div>
      </div>
      {note ? <div className={styles.statNote}>{note}</div> : null}
    </article>
  )
}
