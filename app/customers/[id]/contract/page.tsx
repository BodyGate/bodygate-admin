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

  const [{ data: activeSubscription }, { data: membershipFee }] = await Promise.all([
    supabase
      .from("customer_subscriptions")
      .select("*, subscription_plans(name, price, promo_price, duration_days)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("customer_membership_fees")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const customerName =
    customer.full_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

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
          <ContractOtpPanel
            documentId={documentId}
            customerPhone={customer.phone || ""}
            customerName={customerName || "Cliente"}
          />
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

      <CustomerContract
        customer={customer}
        subscription={activeSubscription || null}
        membershipFee={membershipFee || null}
      />
    </main>
  );
}