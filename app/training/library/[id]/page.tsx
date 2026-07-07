import TrainingPremiumClient from "@/app/components/training/TrainingPremiumClient";
export default async function TrainingExercisePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TrainingPremiumClient view="exercise" exerciseId={id} />; }
