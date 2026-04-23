import { SpecsView } from "./SpecsView";
export const dynamic = "force-dynamic";
export default function SpecsPage({ params }: { params: { id: string } }) {
  return <SpecsView projectId={params.id} />;
}
