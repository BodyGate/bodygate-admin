import type { ComponentPropsWithoutRef, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGCardVariant = "default" | "soft" | "premium" | "danger" | "success" | "warning"

type BGCardProps = ComponentPropsWithoutRef<"section"> & {
  children: ReactNode
  variant?: BGCardVariant
}

const variantClass: Record<BGCardVariant, string> = {
  default: "",
  soft: styles.cardSoft,
  premium: styles.cardPremium,
  danger: styles.cardDanger,
  success: styles.cardSuccess,
  warning: styles.cardWarning,
}

export default function BGCard({
  children,
  variant = "default",
  className = "",
  ...props
}: BGCardProps) {
  return (
    <section
      className={`${styles.card} ${variantClass[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  )
}
