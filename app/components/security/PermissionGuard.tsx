"use client";

import {
  BGButton,
  BGCard,
  BGEmptyState,
  BGPageHeader,
  BGPageShell,
} from "@/components/bodygate-ui";
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
        <BGPageHeader eyebrow="BodyGate Security" title="Verifica permessi in corso" />
        <BGEmptyState
          title="Stiamo validando sessione, ruolo e permessi"
          description="Attendi: la sezione richiesta si aprirà a breve."
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
          actions={<BGButton href="/">Torna alla Dashboard</BGButton>}
        />
        <BGCard variant="danger">
          <p>
            Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a {section}, chiedi a un amministratore di assegnare il permesso richiesto.
          </p>
          <ul>
            <li>Permesso richiesto: {permission}</li>
            <li>Profilo: {staffName || "sessione non riconosciuta"}</li>
            <li>Ruolo: {roleKey || "non configurato"}{isAdmin ? " · amministrazione" : ""}</li>
          </ul>
        </BGCard>
      </BGPageShell>
    );
  }

  return <>{children}</>;
}
