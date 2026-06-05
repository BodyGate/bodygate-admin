"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type BGButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> & {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export default function BGButton({
  children,
  href,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  className = "",
  ...props
}: BGButtonProps) {
  const classes = `bg-button bg-button-${variant} ${className}`.trim();

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      onClick={onClick}
      type={type}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
