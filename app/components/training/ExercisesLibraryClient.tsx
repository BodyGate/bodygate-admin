"use client";

import { useEffect, useMemo, useState } from "react";
import { safeRandomId } from "../../lib/safeRandomId";
import { supabase } from "../../lib/supabaseClient";

type Exercise = any;

export default function ExercisesLibraryClient() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    muscle_group: "",
    equipment: "",
    difficulty: "intermedio",
    machine_brand: "",
    machine_name: "",
    machine_code: "",
    qr_code: "",
    thumbnail_url: "",
    video_url: "",
    tutorial_video_url: "",
    instructions: "",
    coach_tips: "",
    setup_notes: "",
    common_mistakes: "",
  });

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
      .channel(safeRandomId("exercises-library-live"))
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
      .filter(Boolean);

    return ["all", ...Array.from(new Set(groups))];
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      const text = `
        ${exercise.name || ""}
        ${exercise.muscle_group || ""}
        ${exercise.equipment || ""}
        ${exercise.machine_brand || ""}
        ${exercise.machine_name || ""}
        ${exercise.machine_code || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesMuscle =
        muscleFilter === "all" || exercise.muscle_group === muscleFilter;

      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, muscleFilter]);

  function updateForm(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function createExercise(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Inserisci il nome dell'esercizio.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("exercises_library").insert({
      name: form.name.trim(),
      muscle_group: form.muscle_group.trim() || null,
      equipment: form.equipment.trim() || null,
      difficulty: form.difficulty || null,
      machine_brand: form.machine_brand.trim() || null,
      machine_name: form.machine_name.trim() || null,
      machine_code: form.machine_code.trim() || null,
      qr_code: form.qr_code.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      video_url: form.video_url.trim() || null,
      tutorial_video_url: form.tutorial_video_url.trim() || null,
      instructions: form.instructions.trim() || null,
      coach_tips: form.coach_tips.trim() || null,
      setup_notes: form.setup_notes.trim() || null,
      common_mistakes: form.common_mistakes.trim() || null,
      is_active: true,
    });

    setSaving(false);

    if (error) {
      alert("Errore durante il salvataggio esercizio.");
      return;
    }

    setForm({
      name: "",
      muscle_group: "",
      equipment: "",
      difficulty: "intermedio",
      machine_brand: "",
      machine_name: "",
      machine_code: "",
      qr_code: "",
      thumbnail_url: "",
      video_url: "",
      tutorial_video_url: "",
      instructions: "",
      coach_tips: "",
      setup_notes: "",
      common_mistakes: "",
    });

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
          <h1 style={styles.title}>Exercises Media Library</h1>
          <p style={styles.subtitle}>
            Libreria esercizi con macchinari reali, immagini, video tutorial, QR
            macchina e note coach.
          </p>
        </div>
      </section>

      <section style={styles.formPanel}>
        <h2 style={styles.panelTitle}>Nuovo esercizio</h2>

        <form onSubmit={createExercise} style={styles.formGrid}>
          <Field label="Nome esercizio">
            <input
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              style={styles.input}
              placeholder="Es. Chest Press Convergente Matrix"
            />
          </Field>

          <Field label="Gruppo muscolare">
            <input
              value={form.muscle_group}
              onChange={(e) => updateForm("muscle_group", e.target.value)}
              style={styles.input}
              placeholder="Es. Petto"
            />
          </Field>

          <Field label="Attrezzatura">
            <input
              value={form.equipment}
              onChange={(e) => updateForm("equipment", e.target.value)}
              style={styles.input}
              placeholder="Es. Macchina guidata"
            />
          </Field>

          <Field label="Difficoltà">
            <select
              value={form.difficulty}
              onChange={(e) => updateForm("difficulty", e.target.value)}
              style={styles.input}
            >
              <option value="base">Base</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzato">Avanzato</option>
            </select>
          </Field>

          <Field label="Brand macchina">
            <select
              value={form.machine_brand}
              onChange={(e) => updateForm("machine_brand", e.target.value)}
              style={styles.input}
            >
              <option value="">Nessuno</option>
              <option value="Matrix">Matrix</option>
              <option value="Panatta">Panatta</option>
              <option value="Sidero">Sidero</option>
              <option value="Altro">Altro</option>
            </select>
          </Field>

          <Field label="Nome macchina">
            <input
              value={form.machine_name}
              onChange={(e) => updateForm("machine_name", e.target.value)}
              style={styles.input}
              placeholder="Es. Chest Press Convergente"
            />
          </Field>

          <Field label="Codice macchina">
            <input
              value={form.machine_code}
              onChange={(e) => updateForm("machine_code", e.target.value)}
              style={styles.input}
              placeholder="Es. BE-CH-001"
            />
          </Field>

          <Field label="QR Code">
            <input
              value={form.qr_code}
              onChange={(e) => updateForm("qr_code", e.target.value)}
              style={styles.input}
              placeholder="Codice QR o URL"
            />
          </Field>

          <Field label="Thumbnail URL">
            <input
              value={form.thumbnail_url}
              onChange={(e) => updateForm("thumbnail_url", e.target.value)}
              style={styles.input}
              placeholder="URL immagine anteprima"
            />
          </Field>

          <Field label="Video URL">
            <input
              value={form.video_url}
              onChange={(e) => updateForm("video_url", e.target.value)}
              style={styles.input}
              placeholder="URL video breve"
            />
          </Field>

          <Field label="Tutorial Video URL">
            <input
              value={form.tutorial_video_url}
              onChange={(e) => updateForm("tutorial_video_url", e.target.value)}
              style={styles.input}
              placeholder="URL tutorial completo"
            />
          </Field>

          <Field label="Istruzioni">
            <textarea
              value={form.instructions}
              onChange={(e) => updateForm("instructions", e.target.value)}
              style={styles.textarea}
              placeholder="Esecuzione tecnica..."
            />
          </Field>

          <Field label="Coach tips">
            <textarea
              value={form.coach_tips}
              onChange={(e) => updateForm("coach_tips", e.target.value)}
              style={styles.textarea}
              placeholder="Consigli del coach..."
            />
          </Field>

          <Field label="Setup macchina">
            <textarea
              value={form.setup_notes}
              onChange={(e) => updateForm("setup_notes", e.target.value)}
              style={styles.textarea}
              placeholder="Regolazione sedile, schienale, appoggi..."
            />
          </Field>

          <Field label="Errori comuni">
            <textarea
              value={form.common_mistakes}
              onChange={(e) => updateForm("common_mistakes", e.target.value)}
              style={styles.textarea}
              placeholder="Errori da evitare..."
            />
          </Field>

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
              {filteredExercises.length} esercizi visualizzati su{" "}
              {exercises.length}.
            </p>
          </div>

          <div style={styles.filters}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
              placeholder="Cerca esercizio, macchina, brand..."
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
              {exercise.thumbnail_url ? (
                <img
                  src={exercise.thumbnail_url}
                  alt={exercise.name}
                  style={styles.thumbnail}
                />
              ) : (
                <div style={styles.thumbnailPlaceholder}>
                  {exercise.machine_brand || exercise.muscle_group || "BG"}
                </div>
              )}

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
                  {exercise.muscle_group || "N/D"} ·{" "}
                  {exercise.equipment || "N/D"} ·{" "}
                  {exercise.difficulty || "N/D"}
                </p>

                {(exercise.machine_brand || exercise.machine_name) && (
                  <p style={styles.machineMeta}>
                    {exercise.machine_brand || "Brand N/D"} ·{" "}
                    {exercise.machine_name || "Macchina N/D"}
                  </p>
                )}

                {exercise.machine_code && (
                  <div style={styles.machineCode}>{exercise.machine_code}</div>
                )}

                {exercise.coach_tips && (
                  <p style={styles.instructions}>
                    <strong>Coach tip:</strong> {exercise.coach_tips}
                  </p>
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

                {exercise.tutorial_video_url && (
                  <a
                    href={exercise.tutorial_video_url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.linkButton}
                  >
                    Tutorial
                  </a>
                )}

                {exercise.qr_code && (
                  <a
                    href={exercise.qr_code}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.linkButton}
                  >
                    QR
                  </a>
                )}

                <button
                  onClick={() => toggleExercise(exercise)}
                  style={styles.secondaryButton}
                >
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.label}>
      {label}
      {children}
    </label>
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
      "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(15,23,42,0.96) 45%, rgba(2,6,23,1))",
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
    flexWrap: "wrap",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
  textarea: {
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    padding: "13px 14px",
    borderRadius: 14,
    outline: "none",
    minHeight: 90,
    resize: "vertical",
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
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 320px) minmax(180px, 220px)",
    gap: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 24,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  thumbnail: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  thumbnailPlaceholder: {
    height: 180,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.35), rgba(15,23,42,1))",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    color: "#bfdbfe",
    fontWeight: 900,
    fontSize: 22,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardTitle: {
    margin: 0,
    fontSize: 19,
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
  machineMeta: {
    color: "#bfdbfe",
    fontSize: 13,
    marginTop: 8,
    fontWeight: 800,
  },
  machineCode: {
    display: "inline-block",
    marginTop: 8,
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 800,
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
    flexWrap: "wrap",
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