import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCenteredScreenProps = ComponentPropsWithoutRef<"main"> & {
  children: ReactNode
  maxWidth?: "narrow" | "wide"
}

export default function BGCenteredScreen({
  children,
  maxWidth = "narrow",
  className = "",
  ...props
}: BGCenteredScreenProps) {
  const widthClass = maxWidth === "wide" ? styles.centeredScreenWide : styles.centeredScreenNarrow

  return (
    <main className={`${styles.centeredScreen} ${widthClass} ${className}`.trim()} {...props}>
      {children}
    </main>
  )
}
