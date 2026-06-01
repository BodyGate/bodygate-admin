"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type BGButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
};

export default function BGButton({ children, href, onClick, variant = "primary", type = "button", disabled = false }: BGButtonProps) {
  const className = `bg-button bg-button-${variant}`;
  if (href) return <Link className={className} href={href}>{children}</Link>;
  return <button className={className} onClick={onClick} type={type} disabled={disabled}>{children}</button>;
}
