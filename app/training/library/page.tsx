import ExercisesLibraryClient from "@/app/components/training/ExercisesLibraryClient";
import PermissionGuard from "@/app/components/security/PermissionGuard";

export default function ExercisesLibraryPage() {
  return (
    <PermissionGuard permission="manage_training">
      <ExercisesLibraryClient />
    </PermissionGuard>
  );
}