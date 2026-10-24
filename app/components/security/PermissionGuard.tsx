"use client";

import {
  BGButton,
  BGCard,
  BGCenteredStage,
  BGDetailList,
  BGPageHeader,
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
      <BGCenteredStage>
        <BGPageHeader
          eyebrow="BodyGate Security"
          title="Verifica permessi in corso"
          subtitle="Stiamo validando sessione, ruolo e permessi prima di aprire la sezione richiesta."
        />
      </BGCenteredStage>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <BGCenteredStage>
        <BGPageHeader
          eyebrow="BodyGate Security"
          title="Area protetta"
          subtitle={`Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a ${section}, chiedi a un amministratore di assegnare il permesso richiesto.`}
        />
        <BGCard variant="danger">
          <BGDetailList
            items={[
              `Permesso richiesto: ${permission}`,
              `Profilo: ${staffName || "sessione non riconosciuta"}`,
              `Ruolo: ${roleKey || "non configurato"}${isAdmin ? " · amministrazione" : ""}`,
            ]}
          />
          <BGButton href="/">Torna alla Dashboard</BGButton>
        </BGCard>
      </BGCenteredStage>
    );
  }

  return <>{children}</>;
}
