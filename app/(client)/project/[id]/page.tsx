import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DonutChart } from "@/components/DonutChart";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateKr, formatKrw, daysBetween, deadlineTone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomeDashboard({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const projectId = params.id;

  const [projectRes, schedulesRes, costsRes, decisionsRes, commentsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("schedules").select("*").eq("project_id", projectId).order("work_date"),
    supabase.from("cost_items").select("total_price").eq("project_id", projectId),
    supabase
      .from("decisions")
      .select("id,title,deadline,status,category")
      .eq("project_id", projectId)
      .neq("status", "confirmed")
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("comments")
      .select("id,body,created_at,author_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const project = projectRes.data;
  const schedules = schedulesRes.data ?? [];
  const costs = costsRes.data ?? [];
  const decisions = decisionsRes.data ?? [];
  const comments = commentsRes.data ?? [];

  const budget = project?.total_budget ?? 0;
  const spent = costs.reduce((acc, c) => acc + (Number(c.total_price) || 0), 0);
  const budgetRatio = budget > 0 ? spent / budget : 0;

  const doneCount = schedules.filter((s) => s.status === "done").length;
  const progressRatio = schedules.length > 0 ? doneCount / schedules.length : 0;

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const thisWeek = schedules.filter((s) => {
    const d = new Date(s.work_date);
    return d >= startOfWeek && d <= endOfWeek;
  });

  const daysFromStart = project?.start_date ? daysBetween(project.start_date, today) : null;
  const daysToEnd = project?.end_date ? daysBetween(today, project.end_date) : null;

  const urgentDecisions = decisions.filter((d) => {
    if (!d.deadline) return false;
    const days = daysBetween(today, d.deadline);
    return days <= 3;
  });

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="card p-5">
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col items-center">
            <DonutChart
              value={budgetRatio}
              color="#1d4ed8"
              centerLabel={
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-500">예산 집행</span>
                  <span className="text-lg font-semibold">{Math.round(budgetRatio * 100)}%</span>
                </div>
              }
            />
            <p className="mt-2 text-xs text-slate-500 text-center">
              {formatKrw(spent)} / {formatKrw(budget)}
            </p>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <DonutChart
              value={progressRatio}
              color="#10b981"
              centerLabel={
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-500">일정 진행</span>
                  <span className="text-lg font-semibold">{Math.round(progressRatio * 100)}%</span>
                </div>
              }
            />
            <p className="mt-2 text-xs text-slate-500 text-center">
              {doneCount} / {schedules.length} 공정
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500 text-xs">착공</p>
            <p className="font-medium">
              {project?.start_date ? formatDateKr(project.start_date) : "-"}
              {daysFromStart != null && daysFromStart >= 0 ? (
                <span className="ml-1 text-xs text-slate-500">(D+{daysFromStart})</span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500 text-xs">준공</p>
            <p className="font-medium">
              {project?.end_date ? formatDateKr(project.end_date) : "-"}
              {daysToEnd != null && daysToEnd >= 0 ? (
                <span className="ml-1 text-xs text-slate-500">(D-{daysToEnd})</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* 긴급 결정 알림 */}
      {urgentDecisions.length > 0 && (
        <Link href={`/project/${projectId}/decisions`} className="card block p-4 border-rose-200 bg-rose-50">
          <p className="text-xs font-semibold text-rose-700 uppercase">기한 임박 결정 {urgentDecisions.length}건</p>
          <ul className="mt-2 space-y-1 text-sm">
            {urgentDecisions.slice(0, 3).map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span className="truncate">{d.title}</span>
                <span className="text-rose-700 font-medium">D-{daysBetween(today, d.deadline!)}</span>
              </li>
            ))}
          </ul>
        </Link>
      )}

      {/* 이번 주 공사 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-title">이번 주 공사</h2>
          <Link href={`/project/${projectId}/schedule`} className="text-xs text-blue-700">
            전체 →
          </Link>
        </div>
        <div className="space-y-2">
          {thisWeek.length === 0 && <p className="text-sm text-slate-400">이번 주에 예정된 공사가 없습니다.</p>}
          {thisWeek.map((s) => (
            <div key={s.id} className="card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{formatDateKr(s.work_date)}</p>
                  <p className="font-medium">{s.process_name}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              {s.detail_items && <p className="text-xs text-slate-500 mt-1">{s.detail_items}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* 결정 필요 항목 요약 */}
      {decisions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-title">결정 필요</h2>
            <Link href={`/project/${projectId}/decisions`} className="text-xs text-blue-700">
              전체 →
            </Link>
          </div>
          <ul className="space-y-2">
            {decisions.slice(0, 4).map((d) => {
              const tone = deadlineTone(d.deadline);
              const toneCls = tone === "danger" ? "text-rose-700" : tone === "warning" ? "text-amber-700" : "text-slate-500";
              const days = d.deadline ? daysBetween(today, d.deadline) : null;
              return (
                <li key={d.id} className="card p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{d.category}</p>
                    <p className="font-medium truncate">{d.title}</p>
                  </div>
                  <span className={`text-xs ${toneCls}`}>{days != null ? (days < 0 ? `D+${-days}` : `D-${days}`) : "기한 없음"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 최근 업데이트 */}
      {comments.length > 0 && (
        <section>
          <h2 className="section-title mb-2">최근 업데이트</h2>
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="card p-3">
                <p className="text-xs text-slate-500">{formatDateKr(c.created_at)}</p>
                <p className="text-sm mt-1 line-clamp-2">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
