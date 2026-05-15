import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import CustomerForm from "../../../components/CustomerForm";

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
      <main style={{ color: "var(--text)" }}>
        Cliente non trovato.
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: "24px" }}>
      <div>
        <Link
          href={`/customers/${id}`}
          style={{
            color: "var(--accent)",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          ← Torna alla scheda cliente
        </Link>

        <div
          style={{
            color: "var(--muted)",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            marginTop: "28px",
          }}
        >
          BODYGATE CUSTOMERS
        </div>

        <h1
          style={{
            margin: "12px 0 0 0",
            fontSize: "54px",
            lineHeight: 1,
          }}
        >
          Modifica cliente
        </h1>

        <div
          style={{
            marginTop: "14px",
            color: "var(--muted)",
            fontSize: "18px",
          }}
        >
          Aggiorna anagrafica, badge, abbonamento e stato accesso.
        </div>
      </div>

      <CustomerForm mode="edit" customer={customer} />
    </main>
  );
}