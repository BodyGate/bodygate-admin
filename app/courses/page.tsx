import PermissionGuard from "../components/security/PermissionGuard";
import CoursesClient from "./CoursesClient";

export default function CoursesPage() {
  return (
    <PermissionGuard permission="view_courses">
      <CoursesClient />
    </PermissionGuard>
  );
}
