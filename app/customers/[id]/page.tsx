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
      <Link
        className="customer-contract-quick-action"
        href={`/customers/${id}/contract`}
      >
        Contratto
      </Link>

      <CustomerDetailsClient customerId={id} />
    </div>
  );
}
