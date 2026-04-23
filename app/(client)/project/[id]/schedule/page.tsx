import { ScheduleView } from "./ScheduleView";

export const dynamic = "force-dynamic";

export default function SchedulePage({ params }: { params: { id: string } }) {
  return <ScheduleView projectId={params.id} />;
}
