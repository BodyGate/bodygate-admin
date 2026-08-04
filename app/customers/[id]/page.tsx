import UnifiedCustomerDetailsClient from "./UnifiedCustomerDetailsClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <UnifiedCustomerDetailsClient customerId={id} />;
}
