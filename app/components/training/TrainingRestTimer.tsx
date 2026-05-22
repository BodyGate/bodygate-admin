"use client";

import { useEffect, useState } from "react";

export default function TrainingRestTimer({
  seconds,
  visible,
  onClose,
}: {
  seconds: number;
  visible: boolean;
  onClose: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (visible) {
      setTimeLeft(seconds);
      setPaused(false);
    }
  }, [seconds, visible]);

  useEffect(() => {
    if (!visible || paused) return;

    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, paused, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0) {
      try {
        navigator.vibrate?.(300);
      } catch {}

      const audio = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );

      audio.volume = 0.4;

      audio.play().catch(() => {});
    }
  }, [timeLeft]);

  if (!visible) return null;

  const progress =
    seconds > 0
      ? Math.max(0, (timeLeft / seconds) * 100)
      : 0;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.label}>
              Rest Timer
            </div>

            <div style={styles.time}>
              {timeLeft}s
            </div>
          </div>

          <button
            onClick={onClose}
            style={styles.closeButton}
          >
            ✕
          </button>
        </div>

        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>

        <div style={styles.actions}>
          <button
            style={styles.pauseButton}
            onClick={() =>
              setPaused(!paused)
            }
          >
            {paused ? "Riprendi" : "Pausa"}
          </button>

          <button
            style={styles.skipButton}
            onClick={onClose}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },

  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    padding: 22,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.96), rgba(15,23,42,0.98))",
    border:
      "1px solid rgba(255,255,255,0.12)",
    boxShadow:
      "0 25px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(16px)",
    pointerEvents: "auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },

  label: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  time: {
    fontSize: 64,
    fontWeight: 900,
    marginTop: 6,
    lineHeight: 1,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "none",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
  },

  progressBar: {
    height: 12,
    borderRadius: 999,
    background:
      "rgba(255,255,255,0.10)",
    overflow: "hidden",
    marginTop: 22,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    background:
      "linear-gradient(90deg, #60a5fa, #ffffff)",
    transition: "width 1s linear",
  },

  actions: {
    display: "flex",
    gap: 12,
    marginTop: 22,
  },

  pauseButton: {
    flex: 1,
    border: "none",
    borderRadius: 16,
    padding: "14px 16px",
    background:
      "rgba(255,255,255,0.10)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  skipButton: {
    flex: 1,
    border: "none",
    borderRadius: 16,
    padding: "14px 16px",
    background: "#22c55e",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};