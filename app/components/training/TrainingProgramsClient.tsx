"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type TrainingProgram = {
  id: string;
  title: string;
  description: string | null;
  coach_name: string | null;
  goal: string | null;
  is_active: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export default function TrainingProgramsClient() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("Ipertrofia");
  const [coachName, setCoachName] = useState("Coach BodyGate");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [description, setDescription] = useState("");

  async function loadData() {
    setLoading(true);

    const { data: programsData } = await supabase
      .from("training_programs")
      .select(`
        *,
        customers (
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false });

    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("last_name");

    setPrograms(programsData || []);
    setCustomers(customersData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`training-programs-live-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "training_programs",
        },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredPrograms = useMemo(() => {
    return programs.filter((program) => {
      const customerName = `${program.customers?.first_name || ""} ${
        program.customers?.last_name || ""
      }`.trim();

      const haystack = `${program.title} ${program.goal || ""} ${program.coach_name || ""} ${customerName}`.toLowerCase();

      return haystack.includes(search.toLowerCase());
    });
  }, [programs, search]);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();

    if (!customerId) {
      alert("Seleziona un cliente.");
      return;
    }

    if (!title.trim()) {
      alert("Inserisci il titolo del programma.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("training_programs").insert({
      customer_id: customerId,
      title: title.trim(),
      description: description.trim() || null,
      coach_name: coachName.trim() || null,
      goal: goal.trim() || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      alert("Errore durante la creazione del programma.");
      return;
    }

    setCustomerId("");
    setTitle("");
    setGoal("Ipertrofia");
    setCoachName("Coach BodyGate");
    setStartsAt("");
    setEndsAt("");
    setDescription("");

    await loadData();
  }

  async function toggleProgram(program: TrainingProgram) {
    await supabase
      .from("training_programs")
      .update({
        is_active: !program.is_active,
      })
      .eq("id", program.id);

    await loadData();
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>BodyGate Training</p>
          <h1 style={styles.title}>Program Builder</h1>
          <p style={styles.subtitle}>
            Crea programmi allenamento, assegnali ai clienti e prepara la struttura per giorni, esercizi e tracking workout.
          </p>
        </div>
      </section>

      <section style={styles.formPanel}>
        <h2 style={styles.panelTitle}>Nuovo programma</h2>

        <form onSubmit={createProgram} style={styles.formGrid}>
          <label style={styles.label}>
            Cliente
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={styles.input}>
              <option value="">Seleziona cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {`${customer.last_name || ""} ${customer.first_name || ""}`.trim()}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Titolo programma
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              placeholder="Es. Ipertrofia 4 giorni"
            />
          </label>

          <label style={styles.label}>
            Obiettivo
            <select value={goal} onChange={(e) => setGoal(e.target.value)} style={styles.input}>
              <option value="Ipertrofia">Ipertrofia</option>
              <option value="Dimagrimento">Dimagrimento</option>
              <option value="Forza">Forza</option>
              <option value="Ricondizionamento">Ricondizionamento</option>
              <option value="Bodybuilding">Bodybuilding</option>
              <option value="Glutei">Glutei</option>
              <option value="Performance">Performance</option>
            </select>
          </label>

          <label style={styles.label}>
            Coach
            <input
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              style={styles.input}
              placeholder="Nome coach"
            />
          </label>

          <label style={styles.label}>
            Inizio
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Fine
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Descrizione
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
              placeholder="Note generali, focus del mesociclo, indicazioni iniziali..."
            />
          </label>

          <button disabled={saving} style={styles.saveButton}>
            {saving ? "Creazione..." : "Crea programma"}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Programmi</h2>
            <p style={styles.panelSubtitle}>
              {filteredPrograms.length} programmi visualizzati su {programs.length}.
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
            placeholder="Cerca programma..."
          />
        </div>

        {loading ? (
          <div style={styles.empty}>Caricamento programmi...</div>
        ) : filteredPrograms.length === 0 ? (
          <div style={styles.empty}>Nessun programma trovato.</div>
        ) : (
          <div style={styles.grid}>
            {filteredPrograms.map((program) => {
              const customerName = `${program.customers?.first_name || ""} ${
                program.customers?.last_name || ""
              }`.trim();

              return (
                <article key={program.id} style={styles.card}>
                  <div>
                    <div style={styles.cardTop}>
                      <h3 style={styles.cardTitle}>{program.title}</h3>

                      <span
                        style={{
                          ...styles.statusBadge,
                          background: program.is_active
                            ? "rgba(34,197,94,0.16)"
                            : "rgba(239,68,68,0.16)",
                          color: program.is_active ? "#86efac" : "#fca5a5",
                        }}
                      >
                        {program.is_active ? "Attivo" : "Disattivato"}
                      </span>
                    </div>

                    <p style={styles.cardMeta}>{customerName || "Cliente N/D"}</p>

                    <p style={styles.cardInfo}>
                      {program.goal || "Obiettivo N/D"} · {program.coach_name || "Coach N/D"}
                    </p>

                    <p style={styles.cardInfo}>
                      {program.starts_at || "N/D"} → {program.ends_at || "N/D"}
                    </p>

                    {program.description && (
                      <p style={styles.description}>{program.description}</p>
                    )}
                  </div>

                  <div style={styles.cardActions}>
                    <a href={`/training/programs/${program.id}`} style={styles.primaryLink}>
                      Apri builder
                    </a>

                    <button onClick={() => toggleProgram(program)} style={styles.secondaryButton}>
                      {program.is_active ? "Disattiva" : "Attiva"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "#fff",
  },
  hero: {
    padding: 28,
    borderRadius: 28,
    marginBottom: 24,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.98) 45%, rgba(2,6,23,1))",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  eyebrow: {
    color: "#60a5fa",
    textTransform: "uppercase",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 2,
  },
  title: {
    fontSize: 38,
    fontWeight: 900,
    marginTop: 10,
  },
  subtitle: {
    color: "#94a3b8",
    maxWidth: 820,
    lineHeight: 1.6,
  },
  formPanel: {
    padding: 24,
    borderRadius: 28,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 24,
  },
  panel: {
    padding: 24,
    borderRadius: 28,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    marginBottom: 22,
  },
  panelTitle: {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
  },
  panelSubtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginTop: 18,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    padding: "13px 14px",
    borderRadius: 14,
    outline: "none",
  },
  searchInput: {
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    padding: "13px 14px",
    borderRadius: 14,
    outline: "none",
    minWidth: 260,
  },
  saveButton: {
    alignSelf: "end",
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  card: {
    padding: 22,
    borderRadius: 24,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 18,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  cardMeta: {
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    marginTop: 10,
  },
  cardInfo: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 8,
  },
  description: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.5,
    marginTop: 12,
  },
  cardActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryLink: {
    textDecoration: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "11px 14px",
    borderRadius: 13,
    fontWeight: 900,
    fontSize: 13,
  },
  secondaryButton: {
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "11px 14px",
    borderRadius: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  empty: {
    color: "#94a3b8",
    padding: 20,
  },
};