"use client";

import {
  BGButton,
  BGCard,
  BGPageHeader,
  BGPageShell,
  BGStatusBadge,
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
      <main>
        <BGPageShell>
          <BGPageHeader
            eyebrow="BodyGate Security"
            title="Verifica permessi in corso"
            subtitle="Stiamo validando sessione, ruolo e permessi prima di aprire la sezione richiesta."
          />
        </BGPageShell>
      </main>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <main>
        <BGPageShell>
          <BGPageHeader
            eyebrow="BodyGate Security"
            title="Area protetta"
            subtitle={`Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a ${section}, chiedi a un amministratore di assegnare il permesso richiesto.`}
            actions={<BGButton href="/">Torna alla Dashboard</BGButton>}
          />
          <BGCard variant="danger">
            <BGStatusBadge tone="danger">Permesso richiesto: {permission}</BGStatusBadge>{" "}
            <BGStatusBadge tone="neutral">
              Profilo: {staffName || "sessione non riconosciuta"}
            </BGStatusBadge>{" "}
            <BGStatusBadge tone="neutral">
              Ruolo: {roleKey || "non configurato"}
              {isAdmin ? " · amministrazione" : ""}
            </BGStatusBadge>
          </BGCard>
        </BGPageShell>
      </main>
    );
  }

  return <>{children}</>;
}
