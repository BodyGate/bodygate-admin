import Link from "next/link";
import CustomerDetailsClient from "./CustomerDetailsClient";
import "./customer-details-responsive.css";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="customer-details-route-shell">
      <div className="customer-contract-recovery">
        <div>
          <div className="customer-contract-recovery__eyebrow">
            Azione di sicurezza
          </div>
          <div className="customer-contract-recovery__title">
            Contratto cliente
          </div>
          <div className="customer-contract-recovery__copy">
            Apri o recupera il contratto anche se l’onboarding si è interrotto dopo la creazione del cliente.
          </div>
        </div>

        <Link
          className="customer-contract-recovery__button"
          href={`/customers/${id}/contract`}
        >
          Recupera / apri contratto
        </Link>
      </div>

      <CustomerDetailsClient customerId={id} />
    </div>
  );
}
