import Link from "next/link";
type Props = { href?: string; children: React.ReactNode; variant?: "primary" | "gold" | "secondary"; onClick?: () => void };
export default function BGButton({ href, children, variant = "secondary", onClick }: Props) {
  const className = `bg2-btn ${variant === "primary" ? "bg2-btn-primary" : variant === "gold" ? "bg2-btn-gold" : ""}`;
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" className={className} onClick={onClick}>{children}</button>;
}
