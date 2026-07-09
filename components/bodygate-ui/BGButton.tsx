"use client"

import Link from "next/link"
import type { ButtonHTMLAttributes, ReactNode } from "react"

import styles from "./bodygate-ui.module.css"

type BGButtonVariant = "primary" | "secondary" | "danger" | "ghost"

type BGButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: BGButtonVariant
}

const variantClass: Record<BGButtonVariant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  danger: styles.buttonDanger,
  ghost: styles.buttonGhost,
}

export default function BGButton({
  children,
  href,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: BGButtonProps) {
  const classes = `${styles.button} ${variantClass[variant]} ${className}`.trim()

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  )
}
