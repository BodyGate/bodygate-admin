"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  BGAlertCard,
  BGButton,
  BGCard,
  BGFieldGroup,
  BGFormSection,
  BGInput,
  BGStack,
} from "@/components/bodygate-ui";

type Feedback = { tone: "success" | "danger"; text: string } | null;

export default function PasswordSettingsClient() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (next !== confirm) {
      setFeedback({ tone: "danger", text: "La conferma non coincide con la nuova password." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (response.ok && result?.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setFeedback({
          tone: "success",
          text: "Password aggiornata. Dal prossimo accesso usa la nuova password.",
        });
      } else {
        setFeedback({
          tone: "danger",
          text: result?.error || "Impossibile cambiare la password. Riprova.",
        });
      }
    } catch {
      setFeedback({ tone: "danger", text: "Connessione non riuscita. Riprova." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <BGCard>
      <form onSubmit={submit} autoComplete="off">
        <BGStack gap="md">
          <BGFormSection title="Cambia la tua password">
            <BGFieldGroup>
              <label htmlFor="pw-current">Password attuale</label>
              <BGInput
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
              />
            </BGFieldGroup>
            <BGFieldGroup>
              <label htmlFor="pw-new">Nuova password (almeno 12 caratteri)</label>
              <BGInput
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                minLength={12}
                required
              />
            </BGFieldGroup>
            <BGFieldGroup>
              <label htmlFor="pw-confirm">Ripeti la nuova password</label>
              <BGInput
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </BGFieldGroup>
          </BGFormSection>

          {feedback ? (
            <BGAlertCard title={feedback.tone === "success" ? "Fatto" : "Non riuscito"} tone={feedback.tone}>
              {feedback.text}
            </BGAlertCard>
          ) : null}

          <BGButton type="submit" disabled={saving || !current || !next || !confirm}>
            {saving ? "Salvataggio..." : "Aggiorna password"}
          </BGButton>
        </BGStack>
      </form>
    </BGCard>
  );
}
