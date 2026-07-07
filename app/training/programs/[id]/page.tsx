import TrainingPremiumClient from "@/app/components/training/TrainingPremiumClient";
export default async function TrainingProgramPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TrainingPremiumClient view="builder" programId={id} />; }
