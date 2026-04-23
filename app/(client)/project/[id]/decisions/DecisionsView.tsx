"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, Decision, DecisionOption, DecisionStatus, Profile } from "@/lib/types/database";
import { CommentThread } from "@/components/CommentThread";
import { FileUpload } from "@/components/FileUpload";
import { StatusBadge } from "@/components/StatusBadge";
import { cn, daysUntil, deadlineTone, formatDateKr } from "@/lib/utils";
import { ChevronDown, ChevronUp, ExternalLink, Plus, Trash2 } from "lucide-react";

export function DecisionsView({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
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
      const [{ data: ds }, { data: at }] = await Promise.all([
        supabase.from("decisions").select("*").eq("project_id", projectId).order("deadline", { ascending: true, nullsFirst: false }),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "decisions", filter: `project_id=eq.${projectId}` }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [projectId, supabase]);

  const isAdmin = me?.role === "admin";
  const pending = decisions.filter((d) => d.status !== "confirmed");
  const done = decisions.filter((d) => d.status === "confirmed");

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

  async function addDecision() {
    const category = prompt("자재 분류 (예: 마루)");
    if (!category) return;
    const title = prompt("결정 항목명");
    if (!title) return;
    const { data, error } = await supabase
      .from("decisions")
      .insert({ project_id: projectId, category, title, options: [] })
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setDecisions((xs) => [data as unknown as Decision, ...xs]);
  }

  async function deleteDecision(d: Decision) {
    if (!confirm("이 결정 항목을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("decisions").delete().eq("id", d.id);
    if (error) return alert(error.message);
    setDecisions((xs) => xs.filter((x) => x.id !== d.id));
  }

  async function updateDeadline(d: Decision) {
    const v = prompt("결정 기한 (YYYY-MM-DD)", d.deadline ?? "");
    if (v == null) return;
    const { error } = await supabase.from("decisions").update({ deadline: v || null }).eq("id", d.id);
    if (error) return alert(error.message);
    setDecisions((xs) => xs.map((x) => (x.id === d.id ? { ...x, deadline: v || null } : x)));
  }

  async function addOption(d: Decision) {
    const label = prompt("옵션 이름");
    if (!label) return;
    const url = prompt("제품/참고 URL (선택)") || undefined;
    const note = prompt("메모 (선택)") || undefined;
    const nextOpts: DecisionOption[] = [...(d.options ?? []), { label, url, note }];
    const { error } = await supabase.from("decisions").update({ options: nextOpts }).eq("id", d.id);
    if (error) return alert(error.message);
    setDecisions((xs) => xs.map((x) => (x.id === d.id ? { ...x, options: nextOpts } : x)));
  }

  async function updateDescription(d: Decision) {
    const v = prompt("설명 / 안내 문구", d.description ?? "");
    if (v == null) return;
    const { error } = await supabase.from("decisions").update({ description: v || null }).eq("id", d.id);
    if (error) return alert(error.message);
    setDecisions((xs) => xs.map((x) => (x.id === d.id ? { ...x, description: v || null } : x)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">결정 필요 항목</h2>
        {isAdmin && (
          <button onClick={addDecision} className="btn-primary" aria-label="추가">
            <Plus size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}

      <ul className="space-y-2">
        {pending.map((d) => {
          const open = openId === d.id;
          const tone = deadlineTone(d.deadline);
          const toneCls =
            tone === "danger" ? "bg-rose-50 text-rose-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600";
          const days = d.deadline ? daysUntil(d.deadline) : null;
          const decAttachments = attachments.filter((a) => a.ref_type === "decision" && a.ref_id === d.id);
          return (
            <li key={d.id} className="card p-4">
              <button onClick={() => setOpenId(open ? null : d.id)} className="w-full flex items-start justify-between text-left">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{d.category}</p>
                  <p className="font-semibold truncate">{d.title}</p>
                  {d.selected_option && <p className="text-xs text-blue-700 mt-1">선택: {d.selected_option}</p>}
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
                  {d.description && <p className="text-sm whitespace-pre-wrap text-slate-700">{d.description}</p>}

                  <div className="space-y-2">
                    {(d.options ?? []).length === 0 && (
                      <p className="text-xs text-slate-400">아직 옵션이 등록되지 않았습니다.</p>
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
                    {isAdmin && (
                      <button onClick={() => addOption(d)} className="btn-outline w-full">
                        + 옵션 추가
                      </button>
                    )}
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
                        const other = attachments.filter((a) => !(a.ref_type === "decision" && a.ref_id === d.id));
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
                      <button onClick={() => updateDescription(d)} className="btn-outline">설명 편집</button>
                      <button onClick={() => updateDeadline(d)} className="btn-outline">기한 수정</button>
                      {d.status !== "confirmed" && (
                        <button onClick={() => confirmDecision(d)} className="btn-primary">확정</button>
                      )}
                      <button onClick={() => deleteDecision(d)} className="rounded-xl px-3 py-2 text-sm bg-rose-50 text-rose-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <details className="card p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">완료된 결정 {done.length}건</summary>
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
