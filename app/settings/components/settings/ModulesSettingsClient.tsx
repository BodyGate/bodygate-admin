"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type ModuleItem = {
  id: string;
  module_key: string;
  module_name: string;
  description: string;
  is_enabled: boolean;
};

export default function ModulesSettingsClient() {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadModules() {
    setLoading(true);

    const { data } = await supabase
      .from("system_modules")
      .select("*")
      .order("module_name");

    setModules(data || []);
    setLoading(false);
  }

  async function toggleModule(id: string, current: boolean) {
    await supabase
      .from("system_modules")
      .update({
        is_enabled: !current,
      })
      .eq("id", id);

    loadModules();
  }

  useEffect(() => {
    loadModules();
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>BodyGate Platform</p>
          <h1 style={styles.title}>Modules Management</h1>

          <p style={styles.subtitle}>
            Attiva o disattiva funzionalità della piattaforma senza modificare codice.
          </p>
        </div>
      </section>

      {loading ? (
        <div style={styles.loading}>Caricamento moduli...</div>
      ) : (
        <section style={styles.grid}>
          {modules.map((module) => (
            <article key={module.id} style={styles.card}>
              <div>
                <h3 style={styles.cardTitle}>{module.module_name}</h3>

                <p style={styles.cardDescription}>
                  {module.description}
                </p>
              </div>

              <button
                onClick={() =>
                  toggleModule(module.id, module.is_enabled)
                }
                style={{
                  ...styles.toggle,
                  background: module.is_enabled
                    ? "rgba(34,197,94,0.18)"
                    : "rgba(91,61,245,0.18)",
                  borderColor: module.is_enabled
                    ? "rgba(34,197,94,0.45)"
                    : "rgba(91,61,245,0.45)",
                }}
              >
                {module.is_enabled ? "ATTIVO" : "DISATTIVATO"}
              </button>
            </article>
          ))}
        </section>
      )}
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
      "linear-gradient(135deg, rgba(59,130,246,0.20), rgba(15,23,42,0.96) 45%, rgba(2,6,23,1))",

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
    maxWidth: 700,
  },

  loading: {
    color: "#94a3b8",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 18,
  },

  card: {
    padding: 24,
    borderRadius: 24,

    background: "rgba(15,23,42,0.92)",

    border: "1px solid rgba(255,255,255,0.08)",

    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 10,
  },

  cardDescription: {
    color: "#94a3b8",
    lineHeight: 1.5,
  },

  toggle: {
    border: "1px solid",
    padding: "12px 18px",
    borderRadius: 14,
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    minWidth: 140,
  },
};