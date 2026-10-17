"use client";

import { BGButton, BGCenteredNotice } from "@/components/bodygate-ui";
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
      <BGCenteredNotice
        eyebrow="BodyGate Security"
        title="Verifica permessi in corso"
        description="Stiamo validando sessione, ruolo e permessi prima di aprire la sezione richiesta."
      />
    );
  }

  if (!hasPermission(permission)) {
    return (
      <BGCenteredNotice
        variant="danger"
        eyebrow="BodyGate Security"
        title="Area protetta"
        description={`Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a ${section}, chiedi a un amministratore di assegnare il permesso richiesto.`}
        details={[
          `Permesso richiesto: ${permission}`,
          `Profilo: ${staffName || "sessione non riconosciuta"}`,
          `Ruolo: ${roleKey || "non configurato"}${isAdmin ? " · amministrazione" : ""}`,
        ]}
        actions={<BGButton href="/">Torna alla Dashboard</BGButton>}
      />
    );
  }

  return <>{children}</>;
}
