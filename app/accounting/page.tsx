import AccountingClient from "./AccountingClient";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function AccountingPage() {
  return (
    <BGPageShell>
      <AccountingClient />
    </BGPageShell>
  );
}
