import CustomersTable from "../components/CustomersTable";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function CustomersPage() {
  return (
    <main>
      <BGPageShell>
      <CustomersTable />
      </BGPageShell>
    </main>
  );
}
