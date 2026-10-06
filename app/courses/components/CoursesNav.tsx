"use client";

import { BGLinkTabs } from "@/components/bodygate-ui";

const ITEMS = [
  { href: "/courses/admin", label: "Amministrazione" },
  { href: "/courses/calendar", label: "Calendario" },
  { href: "/courses/bookings", label: "Prenotazioni e iscrizioni" },
  { href: "/courses/payments", label: "Pagamenti" },
];

export default function CoursesNav() {
  return <BGLinkTabs items={ITEMS} ariaLabel="Sezioni corsi" />;
}
