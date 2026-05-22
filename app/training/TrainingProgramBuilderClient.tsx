"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Program = any;
type Day = any;
type Exercise = any;
type DayExercise = any;

const defaultDays = [
  "Push",
  "Pull",
  "Legs",
  "Upper",
  "Lower",
];

export default function TrainingProgramBuilderClient({
  programId,
}: {
  programId: string;
}) {
  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDayId, setSelectedDayId] = useState("");
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);

    const { data: programData } = await supabase
      .from("training_programs")
      .select(`
        *,
        customers (
          first_name,
          last_name
        )
      `)
      .eq("id", programId)
      .maybeSingle();

    const { data: daysData } = await supabase
      .from("training_program_days")
      .select("*")
      .eq("program_id", programId)
      .order("sort_order");

    const { data: libraryData } = await supabase
      .from("exercises_library")
      .select("*")
      .order("name");

    const { data: exercisesData } = await supabase
      .from("training_day_exercises")
      .select(`
        *,
        exercises_library (
          name,
          muscle_group,
          equipment
        )
      `)
      .in(
        "day_id",
        (daysData || []).map((d) => d.id)
      )
      .order("sort_order");

    setProgram(programData || null);
    setDays(daysData || []);
    setLibrary(libraryData || []);
    setDayExercises(exercisesData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [programId]);

  const customerName = useMemo(() => {
    return `${program?.customers?.first_name || ""} ${
      program?.customers?.last_name || ""
    }`.trim();
  }, [program]);

  const filteredExercises = useMemo(() => {
    return library.filter((exercise) => {
      const haystack =
        `${exercise.name} ${exercise.muscle_group || ""} ${exercise.equipment || ""}`.toLowerCase();

      return haystack.includes(search.toLowerCase());
    });
  }, [library, search]);

  async function createDay(title: string) {
    await supabase.from("training_program_days").insert({
      program_id: programId,
      title,
      sort_order: days.length + 1,
    });

    await loadData();
  }

  async function addExercise(dayId: string, exercise: Exercise) {
    const existing = dayExercises.filter((e) => e.day_id === dayId);

    await supabase.from("training_day_exercises").insert({
      day_id: dayId,
      exercise_id: exercise.id,
      sets: 4,
      reps: "10-12",
      rir: "1-2",
      rest_seconds: 90,
      tempo: "2-0-2",
      notes: "",
      sort_order: existing.length + 1,
    });

    setSelectedDayId("");
    setSearch("");

    await loadData();
  }

  async function removeExercise(id: string) {
    await supabase
      .from("training_day_exercises")
      .delete()
      .eq("id", id);

    await loadData();
  }

  async function updateExercise(
    id: string,
    field: string,
    value: any
  ) {
    await supabase
      .from("training_day_exercises")
      .update({
        [field]: value,
      })
      .eq("id", id);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Caricamento builder...
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>
            BodyGate Program Builder
          </p>

          <h1 style={styles.title}>
            {program?.title}
          </h1>

          <p style={styles.subtitle}>
            {customerName}
          </p>
        </div>
      </section>

      <section style={styles.daysActions}>
        {defaultDays.map((day) => (
          <button
            key={day}
            style={styles.dayButton}
            onClick={() => createDay(day)}
          >
            + {day}
          </button>
        ))}
      </section>

      <section style={styles.daysGrid}>
        {days.map((day) => {
          const exercises = dayExercises.filter(
            (e) => e.day_id === day.id
          );

          return (
            <article key={day.id} style={styles.dayCard}>
              <div style={styles.dayHeader}>
                <div>
                  <h2 style={styles.dayTitle}>
                    {day.title}
                  </h2>

                  <p style={styles.daySubtitle}>
                    {exercises.length} esercizi
                  </p>
                </div>

                <button
                  style={styles.addButton}
                  onClick={() =>
                    setSelectedDayId(
                      selectedDayId === day.id ? "" : day.id
                    )
                  }
                >
                  + Esercizio
                </button>
              </div>

              {selectedDayId === day.id && (
                <div style={styles.selector}>
                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Cerca esercizio..."
                    style={styles.search}
                  />

                  <div style={styles.selectorList}>
                    {filteredExercises
                      .slice(0, 20)
                      .map((exercise) => (
                        <button
                          key={exercise.id}
                          style={styles.exerciseSelect}
                          onClick={() =>
                            addExercise(day.id, exercise)
                          }
                        >
                          <div>
                            <div style={styles.exerciseName}>
                              {exercise.name}
                            </div>

                            <div style={styles.exerciseMeta}>
                              {exercise.muscle_group} ·{" "}
                              {exercise.equipment}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div style={styles.exerciseList}>
                {exercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    style={styles.exerciseCard}
                  >
                    <div style={styles.exerciseTop}>
                      <div>
                        <div style={styles.exerciseTitle}>
                          {
                            exercise.exercises_library
                              ?.name
                          }
                        </div>

                        <div style={styles.exerciseMeta}>
                          {
                            exercise.exercises_library
                              ?.muscle_group
                          }
                        </div>
                      </div>

                      <button
                        style={styles.removeButton}
                        onClick={() =>
                          removeExercise(exercise.id)
                        }
                      >
                        ✕
                      </button>
                    </div>

                    <div style={styles.configGrid}>
                      <ConfigInput
                        label="Sets"
                        value={exercise.sets || ""}
                        onChange={(v) =>
                          updateExercise(
                            exercise.id,
                            "sets",
                            v
                          )
                        }
                      />

                      <ConfigInput
                        label="Reps"
                        value={exercise.reps || ""}
                        onChange={(v) =>
                          updateExercise(
                            exercise.id,
                            "reps",
                            v
                          )
                        }
                      />

                      <ConfigInput
                        label="RIR"
                        value={exercise.rir || ""}
                        onChange={(v) =>
                          updateExercise(
                            exercise.id,
                            "rir",
                            v
                          )
                        }
                      />

                      <ConfigInput
                        label="Rest"
                        value={
                          exercise.rest_seconds || ""
                        }
                        onChange={(v) =>
                          updateExercise(
                            exercise.id,
                            "rest_seconds",
                            v
                          )
                        }
                      />

                      <ConfigInput
                        label="Tempo"
                        value={exercise.tempo || ""}
                        onChange={(v) =>
                          updateExercise(
                            exercise.id,
                            "tempo",
                            v
                          )
                        }
                      />
                    </div>

                    <textarea
                      defaultValue={exercise.notes || ""}
                      placeholder="Note coach..."
                      style={styles.notes}
                      onBlur={(e) =>
                        updateExercise(
                          exercise.id,
                          "notes",
                          e.target.value
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function ConfigInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <label style={styles.configLabel}>
      {label}

      <input
        defaultValue={value}
        style={styles.configInput}
        onBlur={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 28,
    color: "#fff",
  },

  loading: {
    padding: 40,
    textAlign: "center",
    color: "#94a3b8",
  },

  hero: {
    padding: 32,
    borderRadius: 30,
    marginBottom: 24,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.98) 45%, rgba(2,6,23,1))",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  eyebrow: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  title: {
    fontSize: 40,
    fontWeight: 900,
    marginTop: 12,
  },

  subtitle: {
    color: "#94a3b8",
  },

  daysActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 24,
  },

  dayButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "13px 16px",
    borderRadius: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  daysGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(420px,1fr))",
    gap: 20,
  },

  dayCard: {
    padding: 22,
    borderRadius: 28,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 20,
  },

  dayTitle: {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
  },

  daySubtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },

  addButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "12px 14px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  selector: {
    marginBottom: 20,
  },

  search: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#020617",
    color: "#fff",
    marginBottom: 12,
  },

  selectorList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 280,
    overflow: "auto",
  },

  exerciseSelect: {
    border: "1px solid rgba(255,255,255,0.06)",
    background: "#020617",
    color: "#fff",
    padding: 14,
    borderRadius: 14,
    cursor: "pointer",
    textAlign: "left",
  },

  exerciseName: {
    fontWeight: 800,
  },

  exerciseMeta: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },

  exerciseList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  exerciseCard: {
    padding: 16,
    borderRadius: 18,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  exerciseTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  exerciseTitle: {
    fontWeight: 900,
    fontSize: 16,
  },

  removeButton: {
    border: "none",
    background: "rgba(239,68,68,0.14)",
    color: "#fca5a5",
    borderRadius: 10,
    width: 32,
    height: 32,
    cursor: "pointer",
    fontWeight: 900,
  },

  configGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(80px,1fr))",
    gap: 10,
    marginBottom: 14,
  },

  configLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    color: "#94a3b8",
  },

  configInput: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0f172a",
    color: "#fff",
  },

  notes: {
    width: "100%",
    minHeight: 70,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0f172a",
    color: "#fff",
    resize: "vertical",
  },
};