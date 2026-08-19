import { BGPageShell } from "@/components/bodygate-ui";
import TrainingPremiumClient from "@/app/components/training/TrainingPremiumClient";
export default async function TrainingExercisePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BGPageShell><TrainingPremiumClient view="exercise" exerciseId={id} /></BGPageShell>; }
