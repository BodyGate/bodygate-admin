"use client";

import { usePathname } from "next/navigation";
import { BGLinkNav } from "@/components/bodygate-ui";

const ITEMS = [
  { href: "/courses/admin", label: "Amministrazione" },
  { href: "/courses/calendar", label: "Calendario" },
  { href: "/courses/bookings", label: "Prenotazioni e iscrizioni" },
  { href: "/courses/payments", label: "Pagamenti" },
];

export default function CoursesNav() {
  const pathname = usePathname() ?? "";

  return (
    <BGLinkNav
      ariaLabel="Navigazione corsi"
      items={ITEMS.map((item) => ({
        ...item,
        active: pathname === item.href || pathname.startsWith(`${item.href}/`),
      }))}
    />
  );
}
