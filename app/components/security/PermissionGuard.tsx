"use client";

import { BGButton, BGCard, BGPageHeader, BGPageShell } from "@/components/bodygate-ui";
import { useCurrentPermissions } from "../../hooks/useCurrentPermissions";

export default function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { loading, hasPermission, roleKey, staffName, isAdmin } = useCurrentPermissions();
  const section = "questa sezione";

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
          subtitle={`Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a ${section}, chiedi a un amministratore di assegnare il permesso richiesto.`}
          actions={<BGButton href="/">Torna alla Dashboard</BGButton>}
        />
        <BGCard variant="danger">
          <p>
            <strong>Permesso richiesto:</strong> {permission}
          </p>
          <p>
            <strong>Profilo:</strong> {staffName || "sessione non riconosciuta"}
          </p>
          <p>
            <strong>Ruolo:</strong> {roleKey || "non configurato"}
            {isAdmin ? " · amministrazione" : ""}
          </p>
        </BGCard>
      </BGPageShell>
    );
  }

  return <>{children}</>;
}
