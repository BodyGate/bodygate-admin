import TrainingProgramBuilderClient from "@/app/components/training/TrainingProgramBuilderClient";

export default async function TrainingProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TrainingProgramBuilderClient programId={id} />;
}