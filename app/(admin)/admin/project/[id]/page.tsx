import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditor } from "./ProjectEditor";

export const dynamic = "force-dynamic";

export default async function AdminProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_client_id_fkey(id,name,email)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const client = (project as unknown as { profiles: { id: string; name: string; email: string } | null }).profiles;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/admin" className="hover:underline">프로젝트</Link> <span className="mx-1">/</span> {project.title}
      </nav>
      <ProjectEditor project={project as any} client={client as any} />
      <div className="card p-4">
        <p className="text-sm text-slate-500">
          고객이 보는 실시간 화면은{" "}
          <Link href={`/project/${project.id}`} className="text-blue-700 hover:underline">
            여기에서 동일하게 관리
          </Link>
          할 수 있습니다. 관리자는 모든 일정/결정/내역/스펙을 인라인 편집할 수 있으며, 변경 즉시 고객 화면에 반영됩니다.
        </p>
      </div>
    </div>
  );
}
