"use client";

import {
  BGCard,
  BGButton,
  BGCenteredScreen,
  BGFactList,
  BGPageHeader,
  BGPageShell,
} from "../../../components/bodygate-ui";
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
      <BGCenteredScreen>
        <BGPageShell>
          <BGPageHeader
            eyebrow="BodyGate Security"
            title="Verifica permessi in corso"
            subtitle="Stiamo validando sessione, ruolo e permessi prima di aprire la sezione richiesta."
          />
        </BGPageShell>
      </BGCenteredScreen>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <BGCenteredScreen maxWidth="wide">
        <BGPageShell>
          <BGPageHeader
            eyebrow="BodyGate Security"
            title="Area protetta"
            subtitle={`Il comando richiesto è protetto e i permessi non risultano configurati per il tuo profilo. Se devi accedere a ${section}, chiedi a un amministratore di assegnare il permesso richiesto.`}
            actions={<BGButton href="/">Torna alla Dashboard</BGButton>}
          />
          <BGCard variant="danger">
            <BGFactList
              items={[
                `Permesso richiesto: ${permission}`,
                `Profilo: ${staffName || "sessione non riconosciuta"}`,
                `Ruolo: ${roleKey || "non configurato"}${isAdmin ? " · amministrazione" : ""}`,
              ]}
            />
          </BGCard>
        </BGPageShell>
      </BGCenteredScreen>
    );
  }

  return <>{children}</>;
}
