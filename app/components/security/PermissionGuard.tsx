"use client";

import { BGButton, BGCard, BGPageHeader, BGPageShell } from "../../../components/bodygate-ui";
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
        <BGPageHeader eyebrow="BodyGate Security" title="Area protetta" />
        <BGCard variant="danger">
          <p>
            Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a {section}, chiedi a un amministratore di assegnare il permesso richiesto.
          </p>
          <ul>
            <li>Permesso richiesto: {permission}</li>
            <li>Profilo: {staffName || "sessione non riconosciuta"}</li>
            <li>Ruolo: {roleKey || "non configurato"}{isAdmin ? " · amministrazione" : ""}</li>
          </ul>
          <BGButton href="/">Torna alla Dashboard</BGButton>
        </BGCard>
      </BGPageShell>
    );
  }

  return <>{children}</>;
}
