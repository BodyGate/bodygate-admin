"use client";

export default function ModulesSettingsClient() {
  return (
    <main
      style={{
        padding: 28,
        color: "var(--text)",
      }}
    >
      <h1
        style={{
          fontSize: 42,
          fontWeight: 900,
          marginBottom: 20,
        }}
      >
        Gestione moduli
      </h1>

      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          padding: 24,
        }}
      >
        Sistema moduli BodyGate attivo.
      </div>
    </main>
  );
}