import { createClient } from "@supabase/supabase-js";

import CustomerContract from "../../../../components/CustomerContract";
import CustomerContractPrintButton from "../../../../components/CustomerContractPrintButton";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ContractPrintPage({ params }: Props) {
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
      <main className="contract-print-shell">
        <section className="contract-print-page">Cliente non trovato.</section>
      </main>
    );
  }

  const { data: activeSubscription } = await supabase
    .from("customer_subscriptions")
    .select("*, subscription_plans(name, price, promo_price, duration_days)")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: membershipFee } = await supabase
    .from("customer_membership_fees")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="contract-print-shell">
      <CustomerContractPrintButton customerId={id} />
      <CustomerContract
        customer={customer}
        subscription={activeSubscription || null}
        membershipFee={membershipFee || null}
      />

      <style>{`
        .contract-print-shell {
          min-height: 100vh;
          background: #f3f4f6;
          color: #111827;
          padding: 24px 0;
        }

        .contract-print-page {
          background: #ffffff;
          color: #111827;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 16mm 18mm;
          box-sizing: border-box;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm;
            min-height: 297mm;
            background: #ffffff !important;
            color: #000000 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .contract-document,
          .contract-document * {
            visibility: visible !important;
          }

          .contract-print-shell {
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            background: #ffffff !important;
          }

          .contract-document {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: auto;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </main>
  );
}
