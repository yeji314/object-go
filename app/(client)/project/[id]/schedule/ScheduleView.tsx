"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Schedule, ScheduleStatus, Attachment, Profile } from "@/lib/types/database";
import { StatusBadge } from "@/components/StatusBadge";
import { CommentThread } from "@/components/CommentThread";
import { FileUpload } from "@/components/FileUpload";
import { formatDateKr, formatKrw, weekdayKr, cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

type FilterKey = "all" | "pending" | "in_progress" | "done";

export function ScheduleView({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
        if (active && p) setMe(p as unknown as Profile);
      }
      const [{ data: sch }, { data: att }] = await Promise.all([
        supabase.from("schedules").select("*").eq("project_id", projectId).order("work_date"),
        supabase.from("attachments").select("*").eq("project_id", projectId).eq("ref_type", "schedule"),
      ]);
      if (!active) return;
      setSchedules((sch ?? []) as unknown as Schedule[]);
      setAttachments((att ?? []) as unknown as Attachment[]);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel(`sched-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules", filter: `project_id=eq.${projectId}` }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [projectId, supabase]);

  const isAdmin = me?.role === "admin";

  const filtered = useMemo(() => {
    if (filter === "all") return schedules;
    return schedules.filter((s) => s.status === filter);
  }, [schedules, filter]);

  async function setStatus(s: Schedule, status: ScheduleStatus) {
    const prev = [...schedules];
    setSchedules((xs) => xs.map((x) => (x.id === s.id ? { ...x, status } : x)));
    const { error } = await supabase.from("schedules").update({ status }).eq("id", s.id);
    if (error) {
      alert(error.message);
      setSchedules(prev);
    }
  }

  async function addSchedule() {
    const date = prompt("공사 날짜 (YYYY-MM-DD)");
    if (!date) return;
    const name = prompt("공정명");
    if (!name) return;
    const { data, error } = await supabase
      .from("schedules")
      .insert({ project_id: projectId, work_date: date, process_name: name, day_of_week: weekdayKr(date) })
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setSchedules((xs) => [...xs, data as unknown as Schedule].sort((a, b) => a.work_date.localeCompare(b.work_date)));
  }

  async function deleteSchedule(s: Schedule) {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("schedules").delete().eq("id", s.id);
    if (error) return alert(error.message);
    setSchedules((xs) => xs.filter((x) => x.id !== s.id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { k: "all", label: "전체" },
              { k: "in_progress", label: "진행중" },
              { k: "pending", label: "예정" },
              { k: "done", label: "완료" },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border",
                filter === t.k ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={addSchedule} className="btn-primary" aria-label="일정 추가">
            <Plus size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-slate-400">표시할 일정이 없습니다.</p>}

      <ul className="space-y-2">
        {filtered.map((s) => {
          const open = openId === s.id;
          const schAttachments = attachments.filter((a) => a.ref_type === "schedule" && a.ref_id === s.id);
          return (
            <li key={s.id} className="card p-4">
              <button onClick={() => setOpenId(open ? null : s.id)} className="w-full flex items-start justify-between text-left">
                <div>
                  <p className="text-xs text-slate-500">
                    {formatDateKr(s.work_date)} ({s.day_of_week ?? weekdayKr(s.work_date)})
                  </p>
                  <p className="font-semibold">{s.process_name}</p>
                  {s.detail_items && <p className="text-xs text-slate-500 mt-1">{s.detail_items}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>
              {open && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500 text-xs">소요일수</dt>
                      <dd>{s.duration_days ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs">준비 일정</dt>
                      <dd>{s.prep_schedule ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs">예상 비용</dt>
                      <dd>{formatKrw(s.estimated_cost)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 text-xs">특이사항</dt>
                      <dd>{s.notes ?? "-"}</dd>
                    </div>
                  </dl>

                  {isAdmin && (
                    <div className="flex gap-2">
                      {(["pending", "in_progress", "done"] as ScheduleStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatus(s, st)}
                          className={cn(
                            "flex-1 text-xs py-1.5 rounded-lg border",
                            s.status === st ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-600 border-slate-200"
                          )}
                        >
                          {st === "pending" ? "예정" : st === "in_progress" ? "진행중" : "완료"}
                        </button>
                      ))}
                      <button
                        onClick={() => deleteSchedule(s)}
                        className="rounded-lg px-2 py-1.5 bg-rose-50 text-rose-700"
                        aria-label="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="section-title mb-2">현장 사진</p>
                    <FileUpload
                      projectId={projectId}
                      refType="schedule"
                      refId={s.id}
                      attachments={schAttachments}
                      onChange={(next) => {
                        const other = attachments.filter((a) => !(a.ref_type === "schedule" && a.ref_id === s.id));
                        setAttachments([...other, ...next]);
                      }}
                      canDelete={(a) => isAdmin || a.uploaded_by === me?.id}
                    />
                  </div>

                  <div>
                    <p className="section-title mb-2">요청사항 / 메모</p>
                    <CommentThread projectId={projectId} refType="schedule" refId={s.id} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
