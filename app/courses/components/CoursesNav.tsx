"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/courses/admin", label: "Amministrazione" },
  { href: "/courses/calendar", label: "Calendario" },
  { href: "/courses/bookings", label: "Prenotazioni e iscrizioni" },
];

export default function CoursesNav() {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              color: active ? "#fff" : "var(--muted)",
              background: active ? "linear-gradient(135deg, #5b3df5, #3d2b99)" : "var(--bg-soft)",
              border: "1px solid var(--border)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
