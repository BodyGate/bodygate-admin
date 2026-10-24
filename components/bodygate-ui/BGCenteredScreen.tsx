import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCenteredScreenProps = ComponentPropsWithoutRef<"main"> & {
  children: ReactNode
  size?: "sm" | "md"
}

export default function BGCenteredScreen({
  children,
  size = "md",
  className = "",
  ...props
}: BGCenteredScreenProps) {
  const sizeClass = size === "sm" ? styles.centeredScreenSm : styles.centeredScreenMd

  return (
    <main className={`${styles.centeredScreen} ${sizeClass} ${className}`.trim()} {...props}>
      <div className={styles.centeredScreenInner}>{children}</div>
    </main>
  )
}
