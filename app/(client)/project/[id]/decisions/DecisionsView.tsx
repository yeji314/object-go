"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, Decision, DecisionOption, DecisionStatus, Profile } from "@/lib/types/database";
import { CommentThread } from "@/components/CommentThread";
import { FileUpload } from "@/components/FileUpload";
import { PendingPhotoPicker } from "@/components/PendingPhotoPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { uploadPendingPhotos } from "@/lib/attachments";
import { cn, daysUntil, deadlineTone, formatDateKr } from "@/lib/utils";
import { ChevronDown, ChevronUp, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";

type EditForm = {
  category: string;
  title: string;
  description: string;
  deadline: string;
  options: DecisionOption[];
};

const DRAFT_ID = "__new__";

const emptyForm = (): EditForm => ({
  category: "",
  title: "",
  description: "",
  deadline: "",
  options: [],
});

function toForm(d: Decision): EditForm {
  return {
    category: d.category,
    title: d.title,
    description: d.description ?? "",
    deadline: d.deadline ?? "",
    options: Array.isArray(d.options) ? [...d.options] : [],
  };
}

function fromForm(f: EditForm) {
  return {
    category: f.category.trim(),
    title: f.title.trim(),
    description: f.description.trim() || null,
    deadline: f.deadline || null,
    options: f.options
      .filter((o) => o.label?.trim())
      .map((o) => ({
        label: o.label.trim(),
        url: o.url?.trim() || undefined,
        note: o.note?.trim() || undefined,
      })),
  };
}

export function DecisionsView({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
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
      const [{ data: ds }, { data: at }] = await Promise.all([
        supabase
          .from("decisions")
          .select("*")
          .eq("project_id", projectId)
          .order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("attachments").select("*").eq("project_id", projectId).eq("ref_type", "decision"),
      ]);
      if (!active) return;
      setDecisions((ds ?? []) as unknown as Decision[]);
      setAttachments((at ?? []) as unknown as Attachment[]);
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel(`dec-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decisions", filter: `project_id=eq.${projectId}` },
        load
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [projectId, supabase]);

  const isAdmin = me?.role === "admin";
  const isDrafting = editingId === DRAFT_ID;
  const pending = decisions.filter((d) => d.status !== "confirmed");
  const done = decisions.filter((d) => d.status === "confirmed");

  function startNew() {
    setEditForm(emptyForm());
    setPendingPhotos([]);
    setEditingId(DRAFT_ID);
    setFormError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(d: Decision) {
    setEditForm(toForm(d));
    setPendingPhotos([]);
    setEditingId(d.id);
    setOpenId(d.id);
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setPendingPhotos([]);
    setFormError(null);
  }

  async function saveEdit() {
    if (!editForm.category.trim() || !editForm.title.trim()) {
      setFormError("자재 분류와 결정 항목명은 필수입니다.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = fromForm(editForm);
    try {
      let savedId: string | null = null;
      if (editingId === DRAFT_ID) {
        const { data, error } = await supabase
          .from("decisions")
          .insert({ project_id: projectId, ...payload })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const inserted = data as unknown as Decision;
          savedId = inserted.id;
          setDecisions((xs) => [inserted, ...xs]);
        }
      } else if (editingId) {
        const { data, error } = await supabase
          .from("decisions")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const updated = data as unknown as Decision;
          savedId = updated.id;
          setDecisions((xs) => xs.map((x) => (x.id === editingId ? updated : x)));
        }
      }

      if (savedId && pendingPhotos.length > 0) {
        const uploaded = await uploadPendingPhotos(supabase, {
          projectId,
          refType: "decision",
          refId: savedId,
          userId: me?.id ?? null,
          files: pendingPhotos,
        });
        if (uploaded.length) setAttachments((prev) => [...prev, ...uploaded]);
      }

      setEditingId(null);
      setPendingPhotos([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFormError(msg || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function selectOption(d: Decision, option: string) {
    const prev = [...decisions];
    const next: Decision = { ...d, selected_option: option, status: "decided" as DecisionStatus };
    setDecisions((xs) => xs.map((x) => (x.id === d.id ? next : x)));
    const { error } = await supabase
      .from("decisions")
      .update({ selected_option: option, status: "decided" })
      .eq("id", d.id);
    if (error) {
      alert(error.message);
      setDecisions(prev);
    }
  }

  async function setMemo(d: Decision, memo: string) {
    setDecisions((xs) => xs.map((x) => (x.id === d.id ? { ...x, client_memo: memo } : x)));
    await supabase.from("decisions").update({ client_memo: memo }).eq("id", d.id);
  }

  async function confirmDecision(d: Decision) {
    if (!isAdmin) return;
    const { error } = await supabase.from("decisions").update({ status: "confirmed" }).eq("id", d.id);
    if (error) return alert(error.message);
    setDecisions((xs) => xs.map((x) => (x.id === d.id ? { ...x, status: "confirmed" as DecisionStatus } : x)));
  }

  async function deleteDecision(d: Decision) {
    if (!window.confirm("이 결정 항목을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("decisions").delete().eq("id", d.id);
    if (error) return alert(error.message);
    setDecisions((xs) => xs.filter((x) => x.id !== d.id));
    if (editingId === d.id) setEditingId(null);
    if (openId === d.id) setOpenId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">결정 필요 항목</h2>
        {isAdmin && !isDrafting && (
          <button onClick={startNew} className="btn-primary shrink-0" aria-label="추가">
            <Plus size={16} className="mr-1" /> 새 결정
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}

      {isDrafting && (
        <div className="card p-4 border-2 border-blue-300">
          <p className="section-title mb-3">새 결정 항목</p>
          <EditFormFields form={editForm} onChange={setEditForm} />
          <div className="mt-4">
            <p className="section-title mb-2">참고 사진 (저장 시 업로드)</p>
            <PendingPhotoPicker files={pendingPhotos} onChange={setPendingPhotos} />
          </div>
          {formError && <p className="text-sm text-rose-600 mt-2">{formError}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={cancelEdit} className="btn-outline flex-1">취소</button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {pending.map((d) => {
          const open = openId === d.id;
          const isEditingThis = editingId === d.id;
          const tone = deadlineTone(d.deadline);
          const toneCls =
            tone === "danger"
              ? "bg-rose-50 text-rose-700"
              : tone === "warning"
              ? "bg-amber-50 text-amber-700"
              : "bg-slate-50 text-slate-600";
          const days = d.deadline ? daysUntil(d.deadline) : null;
          const decAttachments = attachments.filter((a) => a.ref_type === "decision" && a.ref_id === d.id);

          return (
            <li key={d.id} className={cn("card p-4", isEditingThis && "border-2 border-blue-300")}>
              {isEditingThis ? (
                <div>
                  <p className="section-title mb-3">결정 편집</p>
                  <EditFormFields form={editForm} onChange={setEditForm} />
                  <div className="mt-4">
                    <p className="section-title mb-2">추가할 사진 (저장 시 업로드)</p>
                    <PendingPhotoPicker files={pendingPhotos} onChange={setPendingPhotos} />
                    <p className="mt-2 text-[11px] text-slate-400">기존 사진은 편집 취소 후 상세 화면에서 관리할 수 있습니다.</p>
                  </div>
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
                    onClick={() => setOpenId(open ? null : d.id)}
                    className="w-full flex items-start justify-between text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{d.category}</p>
                      <p className="font-semibold truncate">{d.title}</p>
                      {d.selected_option && (
                        <p className="text-xs text-blue-700 mt-1">선택: {d.selected_option}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("badge", toneCls)}>
                        {days == null
                          ? "기한 없음"
                          : days < 0
                          ? `마감 ${Math.abs(days)}일 지남`
                          : days === 0
                          ? "오늘 마감"
                          : `D-${days}`}
                      </span>
                      <StatusBadge status={d.status} />
                      {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {open && (
                    <div className="mt-4 space-y-4 border-t border-slate-100 pt-3">
                      {d.description && (
                        <p className="text-sm whitespace-pre-wrap text-slate-700">{d.description}</p>
                      )}
                      {d.deadline && (
                        <p className="text-xs text-slate-500">결정 기한: {formatDateKr(d.deadline)}</p>
                      )}

                      <div className="space-y-2">
                        {(d.options ?? []).length === 0 && (
                          <p className="text-xs text-slate-400">등록된 옵션이 없습니다.</p>
                        )}
                        {(d.options ?? []).map((opt) => {
                          const selected = d.selected_option === opt.label;
                          return (
                            <div
                              key={opt.label}
                              className={cn(
                                "rounded-xl border p-3 flex items-start justify-between gap-3",
                                selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
                              )}
                            >
                              <div className="min-w-0">
                                <p className="font-medium">{opt.label}</p>
                                {opt.note && <p className="text-xs text-slate-500 mt-0.5">{opt.note}</p>}
                                {opt.url && (
                                  <a
                                    href={opt.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 mt-1 text-xs text-blue-700"
                                  >
                                    제품 보기 <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => selectOption(d, opt.label)}
                                className={cn(
                                  "text-xs rounded-full px-3 py-1.5 shrink-0",
                                  selected ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"
                                )}
                              >
                                {selected ? "선택됨" : "선택"}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div>
                        <label className="section-title">고객 메모</label>
                        <textarea
                          className="textarea mt-1"
                          placeholder="선택 이유나 추가 요청을 남겨주세요"
                          defaultValue={d.client_memo ?? ""}
                          onBlur={(e) => {
                            if ((e.target.value || "") !== (d.client_memo ?? "")) setMemo(d, e.target.value);
                          }}
                        />
                      </div>

                      <div>
                        <p className="section-title mb-2">참고 사진</p>
                        <FileUpload
                          projectId={projectId}
                          refType="decision"
                          refId={d.id}
                          attachments={decAttachments}
                          onChange={(next) => {
                            const other = attachments.filter(
                              (a) => !(a.ref_type === "decision" && a.ref_id === d.id)
                            );
                            setAttachments([...other, ...next]);
                          }}
                          canDelete={(a) => isAdmin || a.uploaded_by === me?.id}
                        />
                      </div>

                      <div>
                        <p className="section-title mb-2">소통</p>
                        <CommentThread projectId={projectId} refType="decision" refId={d.id} />
                      </div>

                      {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => startEdit(d)} className="btn-outline">
                            <Pencil size={14} className="mr-1" /> 편집
                          </button>
                          {d.status !== "confirmed" && (
                            <button onClick={() => confirmDecision(d)} className="btn-primary">
                              확정
                            </button>
                          )}
                          <button
                            onClick={() => deleteDecision(d)}
                            className="rounded-xl px-3 py-2 text-sm bg-rose-50 text-rose-700"
                            aria-label="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <details className="card p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            완료된 결정 {done.length}건
          </summary>
          <ul className="mt-3 space-y-2">
            {done.map((d) => (
              <li key={d.id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{d.category}</p>
                <p className="font-medium">{d.title}</p>
                {d.selected_option && <p className="text-xs text-blue-700 mt-0.5">선택: {d.selected_option}</p>}
                {d.deadline && <p className="text-xs text-slate-400 mt-0.5">기한: {formatDateKr(d.deadline)}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EditFormFields({ form, onChange }: { form: EditForm; onChange: (f: EditForm) => void }) {
  function updateOption(i: number, patch: Partial<DecisionOption>) {
    const next = form.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onChange({ ...form, options: next });
  }
  function removeOption(i: number) {
    onChange({ ...form, options: form.options.filter((_, idx) => idx !== i) });
  }
  function addOption() {
    onChange({ ...form, options: [...form.options, { label: "" }] });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="자재 분류 *">
          <input
            className="input"
            placeholder="예: 수전, 마루, 타일"
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
          />
        </Field>
        <Field label="결정 기한">
          <input
            type="date"
            className="input"
            value={form.deadline}
            onChange={(e) => onChange({ ...form, deadline: e.target.value })}
          />
        </Field>
      </div>

      <Field label="결정 항목명 *">
        <input
          className="input"
          placeholder="예: 거실 마루 색상"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </Field>

      <Field label="설명 / 안내">
        <textarea
          className="textarea"
          rows={3}
          placeholder="옵션 선택 시 참고할 설명을 입력하세요"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">선택지 옵션</span>
          <button type="button" onClick={addOption} className="btn-outline text-xs">
            + 옵션 추가
          </button>
        </div>
        {form.options.length === 0 && (
          <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-3 text-center">
            옵션이 없습니다. 위 버튼으로 선택지를 추가해 주세요.
          </p>
        )}
        <ul className="space-y-2">
          {form.options.map((opt, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="옵션 이름 *"
                  value={opt.label}
                  onChange={(e) => updateOption(i, { label: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="shrink-0 p-2 text-slate-500 hover:text-rose-600"
                  aria-label="옵션 삭제"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                className="input"
                placeholder="제품 / 참고 URL (선택)"
                value={opt.url ?? ""}
                onChange={(e) => updateOption(i, { url: e.target.value })}
              />
              <input
                className="input"
                placeholder="메모 (선택, 예: 무광 톤)"
                value={opt.note ?? ""}
                onChange={(e) => updateOption(i, { note: e.target.value })}
              />
            </li>
          ))}
        </ul>
      </div>
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
