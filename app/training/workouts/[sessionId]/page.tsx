import WorkoutSessionClient from "@/app/components/training/WorkoutSessionClient";

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <WorkoutSessionClient sessionId={sessionId} />;
}