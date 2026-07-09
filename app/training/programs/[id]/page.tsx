import TrainingPremiumClient from "@/app/components/training/TrainingPremiumClient";
import BGPageShell from "@/components/bodygate-ui/BGPageShell";
export default async function TrainingProgramPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BGPageShell><TrainingPremiumClient view="builder" programId={id} /></BGPageShell>; }
