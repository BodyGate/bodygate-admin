"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type BGActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export default function BGActionButton({
  children,
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: BGActionButtonProps) {
  return (
    <button
      className={`bg-action-button bg-action-button-${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
