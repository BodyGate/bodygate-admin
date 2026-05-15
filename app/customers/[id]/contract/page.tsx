import { createClient } from "@supabase/supabase-js";

import CustomerContract from "../../../components/CustomerContract";
import CustomerContractActions from "../../../components/CustomerContractActions";
import ContractOtpPanel from "../../../components/ContractOtpPanel";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ContractPage({ params }: Props) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (customerError || !customer) {
    return (
      <main style={{ padding: "40px", color: "white" }}>
        Cliente non trovato.
      </main>
    );
  }

  const { data: existingDocument } = await supabase
    .from("customer_documents")
    .select("*")
    .eq("customer_id", id)
    .eq("document_type", "contract")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId = existingDocument?.id;
  let documentError = "";

  if (!documentId) {
    const { data: newDocument, error: insertError } = await supabase
      .from("customer_documents")
      .insert({
        customer_id: id,
        document_type: "contract",
        title: "Contratto iscrizione palestra",
        status: "generated",
      })
      .select()
      .single();

    if (insertError) {
      documentError = insertError.message;
    }

    documentId = newDocument?.id;
  }

  return (
    <main
      style={{
        background: "#dfe1e5",
        minHeight: "100vh",
        padding: "40px 0",
      }}
    >
      <CustomerContractActions customerId={id} />

      <div
        className="no-print"
        style={{
          width: "210mm",
          margin: "0 auto 20px auto",
        }}
      >
        {documentId ? (
          <ContractOtpPanel documentId={documentId} />
        ) : (
          <div
            style={{
              background: "white",
              color: "red",
              padding: "20px",
              borderRadius: "16px",
              fontWeight: "bold",
            }}
          >
            Errore creazione documento: {documentError || "documentId mancante"}
          </div>
        )}
      </div>

      <CustomerContract customer={customer} />
    </main>
  );
}