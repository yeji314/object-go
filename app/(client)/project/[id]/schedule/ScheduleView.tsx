"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Schedule, ScheduleStatus, Attachment, Profile } from "@/lib/types/database";
import { StatusBadge } from "@/components/StatusBadge";
import { CommentThread } from "@/components/CommentThread";
import { FileUpload } from "@/components/FileUpload";
import { formatDateKr, formatKrw, weekdayKr, cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";

type FilterKey = "all" | "pending" | "in_progress" | "done";

type EditForm = {
  work_date: string;
  process_name: string;
  detail_items: string;
  duration_days: string;
  prep_schedule: string;
  estimated_cost: string;
  status: ScheduleStatus;
  notes: string;
};

const DRAFT_ID = "__new__";

function emptyForm(): EditForm {
  return {
    work_date: new Date().toISOString().slice(0, 10),
    process_name: "",
    detail_items: "",
    duration_days: "",
    prep_schedule: "",
    estimated_cost: "",
    status: "pending",
    notes: "",
  };
}

function toForm(s: Schedule): EditForm {
  return {
    work_date: s.work_date,
    process_name: s.process_name,
    detail_items: s.detail_items ?? "",
    duration_days: s.duration_days != null ? String(s.duration_days) : "",
    prep_schedule: s.prep_schedule ?? "",
    estimated_cost: s.estimated_cost != null ? String(s.estimated_cost) : "",
    status: s.status,
    notes: s.notes ?? "",
  };
}

function fromForm(f: EditForm) {
  return {
    work_date: f.work_date,
    day_of_week: weekdayKr(f.work_date),
    process_name: f.process_name.trim(),
    detail_items: f.detail_items.trim() || null,
    duration_days: f.duration_days ? Number(f.duration_days) : null,
    prep_schedule: f.prep_schedule.trim() || null,
    estimated_cost: f.estimated_cost ? Number(f.estimated_cost) : null,
    status: f.status,
    notes: f.notes.trim() || null,
  };
}

export function ScheduleView({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
  const isDrafting = editingId === DRAFT_ID;

  const filtered = useMemo(() => {
    if (filter === "all") return schedules;
    return schedules.filter((s) => s.status === filter);
  }, [schedules, filter]);

  function startNew() {
    setEditForm(emptyForm());
    setEditingId(DRAFT_ID);
    setFormError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(s: Schedule) {
    setEditForm(toForm(s));
    setEditingId(s.id);
    setOpenId(s.id);
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormError(null);
  }

  async function saveEdit() {
    if (!editForm.work_date || !editForm.process_name.trim()) {
      setFormError("공사 날짜와 공정명은 필수입니다.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = fromForm(editForm);
    try {
      if (editingId === DRAFT_ID) {
        const { data, error } = await supabase
          .from("schedules")
          .insert({ project_id: projectId, ...payload })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const inserted = data as unknown as Schedule;
          setSchedules((xs) => [...xs, inserted].sort((a, b) => a.work_date.localeCompare(b.work_date)));
          setOpenId(inserted.id);
        }
      } else if (editingId) {
        const { data, error } = await supabase
          .from("schedules")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const updated = data as unknown as Schedule;
          setSchedules((xs) =>
            xs.map((x) => (x.id === editingId ? updated : x)).sort((a, b) => a.work_date.localeCompare(b.work_date))
          );
        }
      }
      setEditingId(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFormError(msg || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(s: Schedule) {
    if (!window.confirm("이 일정을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("schedules").delete().eq("id", s.id);
    if (error) return alert(error.message);
    setSchedules((xs) => xs.filter((x) => x.id !== s.id));
    if (editingId === s.id) setEditingId(null);
    if (openId === s.id) setOpenId(null);
  }

  async function setStatus(s: Schedule, status: ScheduleStatus) {
    const prev = [...schedules];
    setSchedules((xs) => xs.map((x) => (x.id === s.id ? { ...x, status } : x)));
    const { error } = await supabase.from("schedules").update({ status }).eq("id", s.id);
    if (error) {
      alert(error.message);
      setSchedules(prev);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
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
                "px-3 py-1.5 rounded-full text-sm border whitespace-nowrap",
                filter === t.k ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isAdmin && !isDrafting && (
          <button onClick={startNew} className="btn-primary shrink-0" aria-label="일정 추가">
            <Plus size={16} className="mr-1" /> 새 일정
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}

      {isDrafting && (
        <div className="card p-4 border-2 border-blue-300">
          <p className="section-title mb-3">새 일정 추가</p>
          <EditFormFields form={editForm} onChange={setEditForm} />
          {formError && <p className="text-sm text-rose-600 mt-2">{formError}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={cancelEdit} className="btn-outline flex-1">취소</button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && !isDrafting && (
        <p className="text-sm text-slate-400">표시할 일정이 없습니다.</p>
      )}

      <ul className="space-y-2">
        {filtered.map((s) => {
          const open = openId === s.id;
          const isEditingThis = editingId === s.id;
          const schAttachments = attachments.filter((a) => a.ref_type === "schedule" && a.ref_id === s.id);

          return (
            <li key={s.id} className={cn("card p-4", isEditingThis && "border-2 border-blue-300")}>
              {isEditingThis ? (
                <div>
                  <p className="section-title mb-3">일정 편집</p>
                  <EditFormFields form={editForm} onChange={setEditForm} />
                  {formError && <p className="text-sm text-rose-600 mt-2">{formError}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={cancelEdit} className="btn-outline flex-1">취소</button>
                    <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                      {saving ? "저장 중…" : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setOpenId(open ? null : s.id)}
                    className="w-full flex items-start justify-between text-left"
                  >
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
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-slate-500 text-xs">소요일수</dt>
                          <dd>{s.duration_days != null ? `${s.duration_days}일` : "-"}</dd>
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
                          <dd className="whitespace-pre-wrap">{s.notes ?? "-"}</dd>
                        </div>
                      </dl>

                      {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          {(["pending", "in_progress", "done"] as ScheduleStatus[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => setStatus(s, st)}
                              className={cn(
                                "flex-1 min-w-[72px] text-xs py-1.5 rounded-lg border",
                                s.status === st
                                  ? "bg-blue-700 text-white border-blue-700"
                                  : "bg-white text-slate-600 border-slate-200"
                              )}
                            >
                              {st === "pending" ? "예정" : st === "in_progress" ? "진행중" : "완료"}
                            </button>
                          ))}
                          <button
                            onClick={() => startEdit(s)}
                            className="rounded-lg px-3 py-1.5 text-xs bg-slate-100 text-slate-700 inline-flex items-center"
                          >
                            <Pencil size={12} className="mr-1" /> 편집
                          </button>
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
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditFormFields({ form, onChange }: { form: EditForm; onChange: (f: EditForm) => void }) {
  const weekday = form.work_date ? weekdayKr(form.work_date) : "";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={`공사 날짜${weekday ? ` (${weekday})` : ""} *`}>
          <input
            type="date"
            className="input"
            value={form.work_date}
            onChange={(e) => onChange({ ...form, work_date: e.target.value })}
          />
        </Field>
        <Field label="소요일수">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="input"
            placeholder="예: 3"
            value={form.duration_days}
            onChange={(e) => onChange({ ...form, duration_days: e.target.value })}
          />
        </Field>
      </div>

      <Field label="공정명 *">
        <input
          className="input"
          placeholder="예: 타일공사"
          value={form.process_name}
          onChange={(e) => onChange({ ...form, process_name: e.target.value })}
        />
      </Field>

      <Field label="세부 항목">
        <input
          className="input"
          placeholder="예: 욕실 벽·바닥 타일"
          value={form.detail_items}
          onChange={(e) => onChange({ ...form, detail_items: e.target.value })}
        />
      </Field>

      <Field label="준비 일정">
        <input
          className="input"
          placeholder="예: 타일 샘플 선택 D-3"
          value={form.prep_schedule}
          onChange={(e) => onChange({ ...form, prep_schedule: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="예상 비용 (원)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="input"
            placeholder="예: 1500000"
            value={form.estimated_cost}
            onChange={(e) => onChange({ ...form, estimated_cost: e.target.value })}
          />
        </Field>
        <Field label="진행 상태">
          <select
            className="input"
            value={form.status}
            onChange={(e) => onChange({ ...form, status: e.target.value as ScheduleStatus })}
          >
            <option value="pending">예정</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </Field>
      </div>

      <Field label="특이사항 / 요청사항">
        <textarea
          className="textarea"
          rows={3}
          placeholder="예: 엘리베이터 양생 시간 확인 필요"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
