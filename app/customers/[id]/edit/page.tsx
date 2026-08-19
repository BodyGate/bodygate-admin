import { createClient } from "@supabase/supabase-js";
import CustomerForm from "../../../components/CustomerForm";
import { BGButton, BGEmptyState, BGPageHeader, BGPageShell } from "@/components/bodygate-ui";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) {
    return (
      <BGPageShell>
        <BGEmptyState title="Cliente non trovato" description="Non è stato possibile caricare i dati del cliente richiesto." />
        <BGButton href="/customers" variant="secondary">Torna ai clienti</BGButton>
      </BGPageShell>
    );
  }

  return (
    <BGPageShell>
      <BGPageHeader eyebrow="BodyGate · Clienti" title="Modifica cliente" subtitle="Aggiorna anagrafica, badge, abbonamento e stato accesso." actions={<BGButton href={`/customers/${id}`} variant="ghost">Torna alla scheda cliente</BGButton>} />
      <CustomerForm mode="edit" customer={customer} />
    </BGPageShell>
  );
}
