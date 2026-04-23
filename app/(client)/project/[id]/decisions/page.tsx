import { DecisionsView } from "./DecisionsView";
export const dynamic = "force-dynamic";
export default function DecisionsPage({ params }: { params: { id: string } }) {
  return <DecisionsView projectId={params.id} />;
}
