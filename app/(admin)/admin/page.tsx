import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateKr, formatKrw } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { NewProjectButton } from "./NewProjectButton";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, address, total_budget, start_date, end_date, status, client_id, profiles!projects_client_id_fkey(name,email)")
    .order("created_at", { ascending: false });

  const { data: pendingDecisions } = await supabase
    .from("decisions")
    .select("id")
    .neq("status", "confirmed");

  const { data: clients } = await supabase.from("profiles").select("id,name,email").eq("role", "client");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">프로젝트</h1>
          <p className="text-sm text-slate-500 mt-1">
            전체 {projects?.length ?? 0}건 · 미결정 {pendingDecisions?.length ?? 0}건
          </p>
        </div>
        <NewProjectButton clients={(clients ?? []) as unknown as { id: string; name: string; email: string }[]} />
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {(projects ?? []).map((p: any) => (
          <li key={p.id}>
            <Link href={`/admin/project/${p.id}`} className="card block p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.profiles?.name ?? "-"} · {p.address ?? "주소 미입력"}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                <div>
                  <span className="block text-[10px] uppercase">착공</span>
                  <span className="text-slate-700 font-medium">{formatDateKr(p.start_date)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">준공</span>
                  <span className="text-slate-700 font-medium">{formatDateKr(p.end_date)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">예산</span>
                  <span className="text-slate-700 font-medium">{formatKrw(p.total_budget)}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {(projects?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          등록된 프로젝트가 없습니다. 우측 상단의 &quot;새 프로젝트&quot; 버튼으로 추가하세요.
        </div>
      )}
    </div>
  );
}
