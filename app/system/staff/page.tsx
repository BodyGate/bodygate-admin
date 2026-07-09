import StaffManagerClient from "./StaffManagerClient";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";

export default function StaffPage() {
  return (
    <BGPageShell>
      <StaffManagerClient />
    </BGPageShell>
  );
}
