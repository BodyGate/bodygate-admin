"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import TrainingRestTimer from "./TrainingRestTimer";
import ExerciseDetailModal from "./ExerciseDetailModal";

type Session = any;
type DayExercise = any;
type SetLog = any;

export default function WorkoutSessionClient({
  sessionId,
}: {
  sessionId: string;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [exercises, setExercises] = useState<DayExercise[]>([]);
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [lastPerformances, setLastPerformances] = useState<
    Record<string, any>
  >({});
  const [records, setRecords] = useState<any[]>([]);
  const [newPrMessage, setNewPrMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [restVisible, setRestVisible] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);

  const [selectedExercise, setSelectedExercise] =
    useState<any>(null);

  const [selectedSuggestion, setSelectedSuggestion] =
    useState<any>(null);

  const [selectedLastPerformance, setSelectedLastPerformance] =
    useState<any>(null);

  async function loadData() {
    setLoading(true);

    const { data: sessionData } = await supabase
      .from("workout_sessions")
      .select(`
        *,
        customers (first_name,last_name),
        training_programs (title),
        training_program_days (title)
      `)
      .eq("id", sessionId)
      .maybeSingle();

    if (!sessionData) {
      setSession(null);
      setLoading(false);
      return;
    }

    const { data: exercisesData } = await supabase
      .from("training_day_exercises")
      .select(`
        *,
        exercises_library (
          *
        )
      `)
      .eq("day_id", sessionData.day_id)
      .order("sort_order");

    const { data: logsData } = await supabase
      .from("workout_set_logs")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");

    const { data: recordsData } = await supabase
      .from("customer_exercise_records")
      .select(`
        *,
        exercises_library(name)
      `)
      .eq("session_id", sessionId)
      .order("achieved_at", { ascending: false });

    setSession(sessionData);
    setExercises(exercisesData || []);
    setSetLogs(logsData || []);
    setRecords(recordsData || []);

    const performanceMap: Record<string, any> = {};

    for (const exercise of exercisesData || []) {
      const { data: latestLog } = await supabase
        .from("workout_set_logs")
        .select(`
          *,
          workout_sessions!inner (
            customer_id
          )
        `)
        .eq("exercise_id", exercise.exercise_id)
        .eq(
          "workout_sessions.customer_id",
          sessionData.customer_id
        )
        .not("actual_load", "is", null)
        .not("actual_reps", "is", null)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (latestLog) {
        performanceMap[exercise.exercise_id] =
          latestLog;
      }
    }

    setLastPerformances(performanceMap);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const customerName = `${
    session?.customers?.first_name || ""
  } ${session?.customers?.last_name || ""}`.trim();

  const completedSets = setLogs.filter(
    (log) => log.completed
  ).length;

  const totalTargetSets = useMemo(() => {
    return exercises.reduce(
      (total, exercise) =>
        total + Number(exercise.sets || 0),
      0
    );
  }, [exercises]);

  const completionPercent =
    totalTargetSets > 0
      ? Math.round(
          (completedSets / totalTargetSets) * 100
        )
      : 0;

  function getLogsForExercise(dayExerciseId: string) {
    return setLogs.filter(
      (log) =>
        log.day_exercise_id === dayExerciseId
    );
  }

  function parseTargetReps(
    repsText: string | null | undefined
  ) {
    if (!repsText) return 8;

    const matches = String(repsText).match(/\d+/g);

    if (!matches || matches.length === 0)
      return 8;

    return Number(
      matches[matches.length - 1] || 8
    );
  }

  function roundToNearestHalf(value: number) {
    return Math.round(value * 2) / 2;
  }

  function getSmartSuggestion(
    exercise: DayExercise,
    lastPerformance: any
  ) {
    if (!lastPerformance) return null;

    const lastLoad = Number(
      lastPerformance.actual_load || 0
    );

    const lastReps = Number(
      lastPerformance.actual_reps || 0
    );

    const targetReps = parseTargetReps(
      exercise.reps
    );

    if (!lastLoad || !lastReps) return null;

    if (lastReps >= targetReps + 2) {
      return {
        label: "Aumenta carico",
        load: roundToNearestHalf(
          lastLoad * 1.05
        ),
        reps: targetReps,
        note:
          "Ultima performance molto sopra target.",
      };
    }

    if (lastReps >= targetReps) {
      return {
        label: "Progressione consigliata",
        load: roundToNearestHalf(
          lastLoad * 1.025
        ),
        reps: targetReps,
        note:
          "Hai chiuso il target: piccolo aumento consigliato.",
      };
    }

    if (lastReps >= targetReps - 2) {
      return {
        label: "Mantieni carico",
        load: lastLoad,
        reps: targetReps,
        note:
          "Consolida prima di aumentare.",
      };
    }

    return {
      label: "Riduci leggermente",
      load: roundToNearestHalf(
        lastLoad * 0.95
      ),
      reps: targetReps,
      note:
        "Ultima performance sotto target.",
    };
  }

  async function updateSetLog(
    logId: string,
    updates: any
  ) {
    await supabase
      .from("workout_set_logs")
      .update(updates)
      .eq("id", logId);

    if (updates.completed) {
      const currentLog = setLogs.find(
        (log) => log.id === logId
      );

      if (currentLog) {
        const currentExercise =
          exercises.find(
            (exercise) =>
              exercise.id ===
              currentLog.day_exercise_id
          );

        const rest = Number(
          currentExercise?.rest_seconds || 90
        );

        setRestSeconds(rest);
        setRestVisible(true);
      }
    }

    await loadData();
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Caricamento workout...
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Sessione non trovata.
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {newPrMessage && (
        <div
          style={styles.prToast}
          onClick={() =>
            setNewPrMessage("")
          }
        >
          🏆 {newPrMessage}
        </div>
      )}

      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>
            BodyGate Live Workout
          </p>

          <h1 style={styles.title}>
            {session?.training_program_days
              ?.title || "Workout"}
          </h1>

          <p style={styles.subtitle}>
            {customerName}
          </p>
        </div>

        <div style={styles.progressCard}>
          <div style={styles.progressValue}>
            {completionPercent}%
          </div>

          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${completionPercent}%`,
              }}
            />
          </div>

          <div style={styles.progressMini}>
            {completedSets}/
            {totalTargetSets} set
          </div>
        </div>
      </section>

      <section style={styles.exerciseStack}>
        {exercises.map((exercise, index) => {
          const logs =
            getLogsForExercise(exercise.id);

          const lastPerformance =
            lastPerformances[
              exercise.exercise_id
            ];

          const suggestion =
            getSmartSuggestion(
              exercise,
              lastPerformance
            );

          return (
            <article
              key={exercise.id}
              style={styles.exerciseCard}
            >
              <div style={styles.exerciseHeader}>
                <div
                  style={
                    styles.exerciseNumber
                  }
                >
                  {index + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <h2
                    style={
                      styles.exerciseTitle
                    }
                  >
                    {
                      exercise
                        .exercises_library
                        ?.name
                    }
                  </h2>

                  <p
                    style={
                      styles.exerciseMeta
                    }
                  >
                    {
                      exercise
                        .exercises_library
                        ?.muscle_group
                    }{" "}
                    ·{" "}
                    {
                      exercise
                        .exercises_library
                        ?.equipment
                    }
                  </p>
                </div>

                <button
                  style={
                    styles.detailsButton
                  }
                  onClick={() => {
                    setSelectedExercise(
                      exercise
                    );

                    setSelectedSuggestion(
                      suggestion
                    );

                    setSelectedLastPerformance(
                      lastPerformance
                    );
                  }}
                >
                  Details
                </button>
              </div>

              {(exercise
                .exercises_library
                ?.thumbnail_url ||
                exercise
                  .exercises_library
                  ?.image_url) && (
                <img
                  src={
                    exercise
                      .exercises_library
                      ?.thumbnail_url ||
                    exercise
                      .exercises_library
                      ?.image_url
                  }
                  alt={
                    exercise
                      .exercises_library
                      ?.name
                  }
                  style={
                    styles.exerciseImage
                  }
                />
              )}

              <div style={styles.targetRow}>
                <TargetBadge
                  label={`${
                    exercise.sets || "-"
                  } sets`}
                />

                <TargetBadge
                  label={`${
                    exercise.reps || "-"
                  } reps`}
                />

                <TargetBadge
                  label={`${
                    exercise.rir || "-"
                  } RIR`}
                />

                <TargetBadge
                  label={`${
                    exercise.rest_seconds ||
                    90
                  }s rest`}
                />
              </div>

              {lastPerformance && (
                <div
                  style={
                    styles.lastPerformanceCard
                  }
                >
                  <div>
                    <div
                      style={
                        styles
                          .lastPerformanceTitle
                      }
                    >
                      Ultima performance
                    </div>

                    <div
                      style={
                        styles
                          .lastPerformanceData
                      }
                    >
                      {
                        lastPerformance.actual_load
                      }{" "}
                      kg ×{" "}
                      {
                        lastPerformance.actual_reps
                      }{" "}
                      reps
                    </div>
                  </div>
                </div>
              )}

              {suggestion && (
                <div
                  style={
                    styles.suggestionCard
                  }
                >
                  <div
                    style={
                      styles.suggestionTop
                    }
                  >
                    🎯 Suggerito oggi
                  </div>

                  <div
                    style={
                      styles.suggestionMain
                    }
                  >
                    {suggestion.load} kg ×{" "}
                    {suggestion.reps} reps
                  </div>

                  <div
                    style={
                      styles.suggestionNote
                    }
                  >
                    {suggestion.note}
                  </div>
                </div>
              )}

              <div style={styles.setStack}>
                {Array.from({
                  length: Number(
                    exercise.sets || 0
                  ),
                }).map((_, setIndex) => {
                  const setNumber =
                    setIndex + 1;

                  const log = logs.find(
                    (l) =>
                      l.set_number ===
                      setNumber
                  );

                  if (!log) return null;

                  return (
                    <SetCard
                      key={log.id}
                      log={log}
                      onUpdate={
                        updateSetLog
                      }
                    />
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <TrainingRestTimer
        seconds={restSeconds}
        visible={restVisible}
        onClose={() =>
          setRestVisible(false)
        }
      />

      <ExerciseDetailModal
        open={!!selectedExercise}
        exercise={selectedExercise}
        suggestion={selectedSuggestion}
        lastPerformance={
          selectedLastPerformance
        }
        onClose={() => {
          setSelectedExercise(null);
          setSelectedSuggestion(null);
          setSelectedLastPerformance(
            null
          );
        }}
      />
    </main>
  );
}

function TargetBadge({
  label,
}: {
  label: string;
}) {
  return (
    <div style={styles.targetBadge}>
      {label}
    </div>
  );
}

function SetCard({
  log,
  onUpdate,
}: {
  log: any;
  onUpdate: (
    logId: string,
    updates: any
  ) => void;
}) {
  const [kg, setKg] = useState(
    log.actual_load || ""
  );

  const [reps, setReps] = useState(
    log.actual_reps || ""
  );

  return (
    <div
      style={{
        ...styles.setCard,
        borderColor: log.completed
          ? "rgba(34,197,94,0.45)"
          : "rgba(255,255,255,0.08)",
      }}
    >
      <div style={styles.setNumber}>
        Set {log.set_number}
      </div>

      <input
        type="number"
        placeholder="Kg"
        value={kg}
        onChange={(e) =>
          setKg(e.target.value)
        }
        onBlur={() =>
          onUpdate(log.id, {
            actual_load: kg
              ? Number(kg)
              : null,
          })
        }
        style={styles.input}
      />

      <input
        type="number"
        placeholder="Reps"
        value={reps}
        onChange={(e) =>
          setReps(e.target.value)
        }
        onBlur={() =>
          onUpdate(log.id, {
            actual_reps: reps
              ? Number(reps)
              : null,
          })
        }
        style={styles.input}
      />

      <button
        style={{
          ...styles.doneButton,
          background: log.completed
            ? "#22c55e"
            : "#2563eb",
        }}
        onClick={() =>
          onUpdate(log.id, {
            completed:
              !log.completed,
          })
        }
      >
        {log.completed ? "✓" : "Done"}
      </button>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 920,
    margin: "0 auto",
    color: "#fff",
  },

  loading: {
    padding: 40,
    textAlign: "center",
    color: "#94a3b8",
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 24,
    borderRadius: 28,
    marginBottom: 16,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.28), rgba(15,23,42,0.98) 45%, rgba(2,6,23,1))",
    border:
      "1px solid rgba(255,255,255,0.08)",
  },

  eyebrow: {
    color: "#60a5fa",
    textTransform: "uppercase",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 2,
    margin: 0,
  },

  title: {
    fontSize: 34,
    fontWeight: 900,
    margin: "10px 0 0",
  },

  subtitle: {
    color: "#94a3b8",
    marginTop: 8,
  },

  progressCard: {
    minWidth: 180,
    padding: 14,
    borderRadius: 20,
    background:
      "rgba(2,6,23,0.65)",
    border:
      "1px solid rgba(255,255,255,0.08)",
  },

  progressValue: {
    fontSize: 34,
    fontWeight: 900,
    marginBottom: 10,
  },

  progressBar: {
    height: 10,
    borderRadius: 999,
    background:
      "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    background: "#2563eb",
  },

  progressMini: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  exerciseStack: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  exerciseCard: {
    padding: 20,
    borderRadius: 26,
    background:
      "rgba(15,23,42,0.94)",
    border:
      "1px solid rgba(255,255,255,0.08)",
  },

  exerciseHeader: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },

  exerciseNumber: {
    width: 38,
    height: 38,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background:
      "rgba(37,99,235,0.22)",
    color: "#bfdbfe",
    fontWeight: 900,
    flexShrink: 0,
  },

  exerciseTitle: {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
  },

  exerciseMeta: {
    color: "#94a3b8",
    marginTop: 6,
  },

  detailsButton: {
    border: "none",
    background:
      "rgba(59,130,246,0.18)",
    color: "#bfdbfe",
    padding: "10px 12px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  exerciseImage: {
    width: "100%",
    height: 220,
    objectFit: "cover",
    borderRadius: 18,
    marginBottom: 14,
    border:
      "1px solid rgba(255,255,255,0.08)",
  },

  targetRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 14,
  },

  targetBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background:
      "rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 700,
  },

  lastPerformanceCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    background:
      "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(15,23,42,0.9))",
    border:
      "1px solid rgba(34,197,94,0.25)",
  },

  lastPerformanceTitle: {
    color: "#86efac",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },

  lastPerformanceData: {
    fontSize: 22,
    fontWeight: 900,
    marginTop: 8,
  },

  suggestionCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.18), rgba(15,23,42,0.95))",
    border:
      "1px solid rgba(250,204,21,0.25)",
  },

  suggestionTop: {
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },

  suggestionMain: {
    fontSize: 24,
    fontWeight: 900,
    marginTop: 8,
  },

  suggestionNote: {
    color: "#fef3c7",
    fontSize: 12,
    marginTop: 6,
  },

  setStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  setCard: {
    display: "grid",
    gridTemplateColumns:
      "70px 1fr 1fr 84px",
    gap: 8,
    alignItems: "center",
    padding: 10,
    borderRadius: 18,
    border: "1px solid",
  },

  setNumber: {
    fontWeight: 900,
    color: "#cbd5e1",
    fontSize: 13,
  },

  input: {
    padding: "12px 9px",
    borderRadius: 13,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background: "#0f172a",
    color: "#fff",
    outline: "none",
    minWidth: 0,
    fontWeight: 800,
  },

  doneButton: {
    border: "none",
    borderRadius: 13,
    padding: "12px 8px",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  prToast: {
    position: "sticky",
    top: 20,
    zIndex: 999,
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(22,101,52,0.95))",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};