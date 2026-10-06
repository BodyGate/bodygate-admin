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

  return <BGLinkNav items={ITEMS} activeHref={pathname} ariaLabel="Navigazione corsi" />;
}
