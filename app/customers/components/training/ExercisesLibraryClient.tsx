"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  difficulty: string | null;
  video_url: string | null;
  instructions: string | null;
  is_active: boolean;
};

export default function ExercisesLibraryClient() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [difficulty, setDifficulty] = useState("intermedio");
  const [videoUrl, setVideoUrl] = useState("");
  const [instructions, setInstructions] = useState("");

  async function loadExercises() {
    const { data } = await supabase
      .from("exercises_library")
      .select("*")
      .order("name");

    setExercises(data || []);
  }

  useEffect(() => {
    loadExercises();

    const channel = supabase
      .channel(`exercises-library-live-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exercises_library",
        },
        loadExercises
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const muscleGroups = useMemo(() => {
    const groups = exercises
      .map((exercise) => exercise.muscle_group)
      .filter(Boolean) as string[];

    return ["all", ...Array.from(new Set(groups))];
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesSearch =
        exercise.name.toLowerCase().includes(search.toLowerCase()) ||
        (exercise.muscle_group || "").toLowerCase().includes(search.toLowerCase()) ||
        (exercise.equipment || "").toLowerCase().includes(search.toLowerCase());

      const matchesMuscle =
        muscleFilter === "all" || exercise.muscle_group === muscleFilter;

      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, muscleFilter]);

  async function createExercise(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Inserisci il nome dell'esercizio.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("exercises_library").insert({
      name: name.trim(),
      muscle_group: muscleGroup.trim() || null,
      equipment: equipment.trim() || null,
      difficulty,
      video_url: videoUrl.trim() || null,
      instructions: instructions.trim() || null,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      alert("Errore durante il salvataggio esercizio.");
      return;
    }

    setName("");
    setMuscleGroup("");
    setEquipment("");
    setDifficulty("intermedio");
    setVideoUrl("");
    setInstructions("");

    await loadExercises();
  }

  async function toggleExercise(exercise: Exercise) {
    await supabase
      .from("exercises_library")
      .update({ is_active: !exercise.is_active })
      .eq("id", exercise.id);

    await loadExercises();
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>BodyGate Training</p>
          <h1 style={styles.title}>Exercises Library</h1>
          <p style={styles.subtitle}>
            Libreria esercizi centralizzata per creare programmi allenamento e schede clienti.
          </p>
        </div>
      </section>

      <section style={styles.formPanel}>
        <h2 style={styles.panelTitle}>Nuovo esercizio</h2>

        <form onSubmit={createExercise} style={styles.formGrid}>
          <label style={styles.label}>
            Nome esercizio
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              placeholder="Es. Panca piana bilanciere"
            />
          </label>

          <label style={styles.label}>
            Gruppo muscolare
            <input
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              style={styles.input}
              placeholder="Es. Petto"
            />
          </label>

          <label style={styles.label}>
            Attrezzatura
            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              style={styles.input}
              placeholder="Es. Bilanciere"
            />
          </label>

          <label style={styles.label}>
            Difficoltà
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              style={styles.input}
            >
              <option value="base">Base</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzato">Avanzato</option>
            </select>
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Video URL
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              style={styles.input}
              placeholder="Link video dimostrativo"
            />
          </label>

          <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
            Istruzioni
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
              placeholder="Note tecniche, setup, esecuzione..."
            />
          </label>

          <button disabled={saving} style={styles.saveButton}>
            {saving ? "Salvataggio..." : "Crea esercizio"}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Archivio esercizi</h2>
            <p style={styles.panelSubtitle}>
              {filteredExercises.length} esercizi visualizzati su {exercises.length}.
            </p>
          </div>

          <div style={styles.filters}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
              placeholder="Cerca esercizio..."
            />

            <select
              value={muscleFilter}
              onChange={(e) => setMuscleFilter(e.target.value)}
              style={styles.input}
            >
              {muscleGroups.map((group) => (
                <option key={group} value={group}>
                  {group === "all" ? "Tutti i gruppi" : group}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.grid}>
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} style={styles.card}>
              <div>
                <div style={styles.cardTop}>
                  <h3 style={styles.cardTitle}>{exercise.name}</h3>
                  <span
                    style={{
                      ...styles.status,
                      background: exercise.is_active
                        ? "rgba(34,197,94,0.16)"
                        : "rgba(239,68,68,0.16)",
                      color: exercise.is_active ? "#86efac" : "#fca5a5",
                    }}
                  >
                    {exercise.is_active ? "Attivo" : "Disattivato"}
                  </span>
                </div>

                <p style={styles.cardMeta}>
                  {exercise.muscle_group || "N/D"} · {exercise.equipment || "N/D"} ·{" "}
                  {exercise.difficulty || "N/D"}
                </p>

                {exercise.instructions && (
                  <p style={styles.instructions}>{exercise.instructions}</p>
                )}
              </div>

              <div style={styles.cardActions}>
                {exercise.video_url && (
                  <a
                    href={exercise.video_url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.linkButton}
                  >
                    Video
                  </a>
                )}

                <button onClick={() => toggleExercise(exercise)} style={styles.secondaryButton}>
                  {exercise.is_active ? "Disattiva" : "Attiva"}
                </button>
              </div>
            </article>
          ))}

          {filteredExercises.length === 0 && (
            <div style={styles.empty}>Nessun esercizio trovato.</div>
          )}
        </div>
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
      "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(15,23,42,0.96) 45%, rgba(2,6,23,1))",
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
    maxWidth: 760,
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
  saveButton: {
    alignSelf: "end",
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "220px 200px",
    gap: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 22,
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
    fontSize: 18,
    fontWeight: 900,
  },
  status: {
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  cardMeta: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 8,
  },
  instructions: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.5,
    marginTop: 12,
  },
  cardActions: {
    display: "flex",
    gap: 10,
  },
  linkButton: {
    textDecoration: "none",
    background: "rgba(59,130,246,0.18)",
    color: "#bfdbfe",
    padding: "10px 13px",
    borderRadius: 12,
    fontWeight: 800,
    fontSize: 13,
  },
  secondaryButton: {
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "10px 13px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  empty: {
    color: "#94a3b8",
    padding: 20,
  },
};