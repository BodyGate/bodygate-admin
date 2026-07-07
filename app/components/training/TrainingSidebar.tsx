"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./training-premium.module.css";

const menu = [
  { label: "Dashboard", href: "/training" },
  { label: "Atleti", href: "/training/clients" },
  { label: "Programmi", href: "/training/programs" },
  { label: "Sessioni", href: "/training/sessions" },
  { label: "Libreria", href: "/training/library" },
];

export default function TrainingSidebar() {
  const pathname = usePathname();
  return <aside className={styles.sidebar}>
    <p className={styles.kicker}>BodyGate</p><h2>Training</h2>
    <nav className={styles.list}>{menu.map((item) => <Link className={pathname === item.href ? styles.activeLink : styles.navLink} key={item.href} href={item.href}>{item.label}</Link>)}</nav>
  </aside>;
}
