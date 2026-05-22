import TrainingProgramsClient from "@/app/components/training/TrainingProgramsClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function TrainingProgramsPage() {
  return (
    <PermissionGuard permission="manage_training">
      <TrainingProgramsClient />
    </PermissionGuard>
  );
}