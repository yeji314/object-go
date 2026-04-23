import { CostsView } from "./CostsView";
export const dynamic = "force-dynamic";
export default function CostsPage({ params }: { params: { id: string } }) {
  return <CostsView projectId={params.id} />;
}
