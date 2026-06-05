"use client";

import BGQuickActionCard from "../ui/BGQuickActionCard";

export default function QuickLinksPanel() {
  return (
    <section className="bg-card bg-card-premium bg-section">
      <div className="bg-section-header">
        <div>
          <h2 className="bg-section-title">Backoffice</h2>
          <p className="bg-section-subtitle">
            Gestione clienti, badge, abbonamenti, pagamenti e programmi.
          </p>
        </div>
      </div>

      <div className="bg-actions-grid">
        <BGQuickActionCard
          href="/customers"
          icon="C"
          title="Clienti"
          description="Anagrafiche, stato iscrizioni e schede operative."
        />
        <BGQuickActionCard
          href="/badges"
          icon="B"
          title="Badge"
          description="Credenziali fisiche, badge associati e accessi."
        />
        <BGQuickActionCard
          href="/subscriptions"
          icon="S"
          title="Abbonamenti"
          description="Piani, scadenze e rinnovi in evidenza."
        />
        <BGQuickActionCard
          href="/payments"
          icon="€"
          title="Pagamenti"
          description="Incassi, ricevute e storico economico."
        />
      </div>
    </section>
  );
}
