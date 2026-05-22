"use client";

type ExerciseDetailModalProps = {
  open: boolean;
  exercise: any;
  suggestion?: any;
  lastPerformance?: any;
  onClose: () => void;
};

export default function ExerciseDetailModal({
  open,
  exercise,
  suggestion,
  lastPerformance,
  onClose,
}: ExerciseDetailModalProps) {
  if (!open || !exercise) return null;

  const data = exercise.exercises_library || exercise;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Exercise Guide</p>
            <h2 style={styles.title}>{data.name || "Esercizio"}</h2>
            <p style={styles.subtitle}>
              {data.muscle_group || "N/D"} · {data.equipment || "N/D"}
            </p>
          </div>

          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        {data.thumbnail_url || data.image_url ? (
          <img
            src={data.thumbnail_url || data.image_url}
            alt={data.name}
            style={styles.image}
          />
        ) : (
          <div style={styles.placeholder}>
            {data.machine_brand || data.muscle_group || "BodyGate"}
          </div>
        )}

        {(data.machine_brand || data.machine_name || data.machine_code) && (
          <div style={styles.machineBox}>
            <div style={styles.machineTitle}>Macchina</div>
            <div style={styles.machineText}>
              {data.machine_brand || "Brand N/D"} ·{" "}
              {data.machine_name || "Macchina N/D"}
            </div>
            {data.machine_code && (
              <div style={styles.machineCode}>{data.machine_code}</div>
            )}
          </div>
        )}

        {lastPerformance && (
          <div style={styles.performanceBox}>
            <div style={styles.boxLabel}>Ultima performance</div>
            <div style={styles.boxValue}>
              {lastPerformance.actual_load || "-"} kg ×{" "}
              {lastPerformance.actual_reps || "-"} reps
            </div>
          </div>
        )}

        {suggestion && (
          <div style={styles.suggestionBox}>
            <div style={styles.boxLabel}>🎯 Suggerito oggi</div>
            <div style={styles.boxValue}>
              {suggestion.load} kg × {suggestion.reps} reps
            </div>
            <p style={styles.smallText}>{suggestion.note}</p>
          </div>
        )}

        <div style={styles.contentGrid}>
          {data.instructions && (
            <InfoBlock title="Esecuzione" text={data.instructions} />
          )}

          {data.setup_notes && (
            <InfoBlock title="Setup macchina" text={data.setup_notes} />
          )}

          {data.coach_tips && (
            <InfoBlock title="Coach tips" text={data.coach_tips} />
          )}

          {data.common_mistakes && (
            <InfoBlock title="Errori comuni" text={data.common_mistakes} />
          )}
        </div>

        <div style={styles.actions}>
          {(data.video_url || data.tutorial_video_url) && (
            <a
              href={data.tutorial_video_url || data.video_url}
              target="_blank"
              rel="noreferrer"
              style={styles.primaryLink}
            >
              Apri video
            </a>
          )}

          {data.qr_code && (
            <a
              href={data.qr_code}
              target="_blank"
              rel="noreferrer"
              style={styles.secondaryLink}
            >
              QR macchina
            </a>
          )}

          <button onClick={onClose} style={styles.secondaryButton}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.infoBlock}>
      <div style={styles.infoTitle}>{title}</div>
      <p style={styles.infoText}>{text}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "92vh",
    overflow: "auto",
    borderRadius: 30,
    padding: 22,
    background: "#020617",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  eyebrow: {
    margin: 0,
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  title: {
    margin: "8px 0 0",
    fontSize: 28,
    fontWeight: 900,
    color: "#fff",
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 6,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  image: {
    width: "100%",
    height: 260,
    objectFit: "cover",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  placeholder: {
    height: 220,
    borderRadius: 22,
    display: "grid",
    placeItems: "center",
    marginBottom: 16,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.32), rgba(15,23,42,1))",
    color: "#bfdbfe",
    fontWeight: 900,
    fontSize: 24,
  },
  machineBox: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.18)",
    marginBottom: 12,
  },
  machineTitle: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  machineText: {
    color: "#fff",
    fontWeight: 900,
    marginTop: 6,
  },
  machineCode: {
    display: "inline-block",
    marginTop: 8,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },
  performanceBox: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.22)",
    marginBottom: 12,
  },
  suggestionBox: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(250,204,21,0.12)",
    border: "1px solid rgba(250,204,21,0.22)",
    marginBottom: 12,
  },
  boxLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  boxValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
    marginTop: 8,
  },
  smallText: {
    color: "#fef3c7",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 0,
  },
  contentGrid: {
    display: "grid",
    gap: 12,
    marginTop: 12,
  },
  infoBlock: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  infoTitle: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoText: {
    color: "#cbd5e1",
    lineHeight: 1.6,
    marginBottom: 0,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryLink: {
    textDecoration: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "13px 16px",
    borderRadius: 14,
    fontWeight: 900,
  },
  secondaryLink: {
    textDecoration: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "13px 16px",
    borderRadius: 14,
    fontWeight: 900,
  },
  secondaryButton: {
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "13px 16px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
};