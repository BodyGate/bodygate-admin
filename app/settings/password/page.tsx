import { BGPageHeader, BGPageShell } from "@/components/bodygate-ui";
import PasswordSettingsClient from "@/app/components/settings/PasswordSettingsClient";

// Aperta a ogni utente autenticato: ognuno cambia solo la propria password.
export default function PasswordPage() {
  return (
    <BGPageShell>
      <BGPageHeader
        title="La tua password"
        subtitle="Cambia la password di accesso a BodyGate. Serve la password attuale."
      />
      <PasswordSettingsClient />
    </BGPageShell>
  );
}
