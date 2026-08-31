import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import CustomerForm from "../../../components/CustomerForm";
import { BGButton, BGEmptyState, BGPageHeader, BGPageShell } from "@/components/bodygate-ui";
import { requireSession, UnauthorizedError } from "../../../lib/server/auth";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL mancante");
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  return createClient(supabaseUrl, supabaseServiceKey);
}

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;

  try {
    await requireSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw error;
  }

  const supabase = getSupabaseClient();

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
