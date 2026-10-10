"use client";

import { BGButton, BGEmptyState, BGPageHeader, BGPageShell, BGSection } from "@/components/bodygate-ui";
import { useCurrentPermissions } from "../../hooks/useCurrentPermissions";

export default function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { loading, hasPermission, roleKey, staffName, isAdmin } = useCurrentPermissions();

  if (loading) {
    return (
      <BGPageShell>
        <BGPageHeader
          eyebrow="BodyGate Security"
          title="Verifica permessi in corso"
          subtitle="Stiamo validando sessione, ruolo e permessi prima di aprire la sezione richiesta."
        />
      </BGPageShell>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <BGPageShell>
        <BGPageHeader
          eyebrow="BodyGate Security"
          title="Area protetta"
          subtitle="Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a questa sezione, chiedi a un amministratore di assegnare il permesso richiesto."
          actions={<BGButton href="/">Torna alla Dashboard</BGButton>}
        />
        <BGSection title="Dettagli accesso">
          <BGEmptyState
            title={`Permesso richiesto: ${permission}`}
            description={`Profilo: ${staffName || "sessione non riconosciuta"} · Ruolo: ${roleKey || "non configurato"}${isAdmin ? " · amministrazione" : ""}`}
          />
        </BGSection>
      </BGPageShell>
    );
  }

  return <>{children}</>;
}
