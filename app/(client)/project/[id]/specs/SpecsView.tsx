"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, Profile, SpecStatus, SwitchSpec } from "@/lib/types/database";
import { FileUpload } from "@/components/FileUpload";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ExternalLink, Plus, Trash2 } from "lucide-react";

export function SpecsView({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [specs, setSpecs] = useState<SwitchSpec[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"switch" | "outlet">("switch");
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
      const [{ data: ss }, { data: at }] = await Promise.all([
        supabase.from("switch_specs").select("*").eq("project_id", projectId).order("space"),
        supabase.from("attachments").select("*").eq("project_id", projectId).eq("ref_type", "switch_spec"),
      ]);
      if (!active) return;
      setSpecs((ss ?? []) as unknown as SwitchSpec[]);
      setAttachments((at ?? []) as unknown as Attachment[]);
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel(`specs-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "switch_specs", filter: `project_id=eq.${projectId}` }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [projectId, supabase]);

  const isAdmin = me?.role === "admin";

  const grouped = useMemo(() => {
    const list = specs.filter((s) => s.item_type === tab);
    const map = new Map<string, SwitchSpec[]>();
    for (const s of list) {
      if (!map.has(s.space)) map.set(s.space, []);
      map.get(s.space)!.push(s);
    }
    return Array.from(map.entries());
  }, [specs, tab]);

  async function setStatus(s: SwitchSpec, status: SpecStatus) {
    const prev = [...specs];
    setSpecs((xs) => xs.map((x) => (x.id === s.id ? { ...x, status } : x)));
    const { error } = await supabase.from("switch_specs").update({ status }).eq("id", s.id);
    if (error) {
      alert(error.message);
      setSpecs(prev);
    }
  }

  async function addSpec() {
    const space = prompt("설치 공간 (예: 신발장, 부엌, 안방)");
    if (!space) return;
    const brand_line = prompt("브랜드/라인 (예: JUNG LS990)") || null;
    const spec_detail = prompt("상세 사양 (예: 3구, 디밍)") || null;
    const quantity = Number(prompt("수량") || "1");
    const product_url = prompt("구매/참고 URL (선택)") || null;
    const notes = prompt("비고 (선택)") || null;
    const { data, error } = await supabase
      .from("switch_specs")
      .insert({ project_id: projectId, item_type: tab, space, brand_line, spec_detail, quantity, product_url, notes })
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setSpecs((xs) => [...xs, data as unknown as SwitchSpec]);
  }

  async function editSpec(s: SwitchSpec) {
    const space = prompt("설치 공간", s.space) ?? s.space;
    const brand_line = prompt("브랜드/라인", s.brand_line ?? "") ?? s.brand_line;
    const spec_detail = prompt("상세 사양", s.spec_detail ?? "") ?? s.spec_detail;
    const quantity = Number(prompt("수량", String(s.quantity ?? 0)) || "0");
    const product_url = prompt("구매/참고 URL", s.product_url ?? "") ?? s.product_url;
    const notes = prompt("비고", s.notes ?? "") ?? s.notes;
    const { data, error } = await supabase
      .from("switch_specs")
      .update({ space, brand_line, spec_detail, quantity, product_url, notes })
      .eq("id", s.id)
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setSpecs((xs) => xs.map((x) => (x.id === s.id ? (data as unknown as SwitchSpec) : x)));
  }

  async function deleteSpec(s: SwitchSpec) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("switch_specs").delete().eq("id", s.id);
    if (error) return alert(error.message);
    setSpecs((xs) => xs.filter((x) => x.id !== s.id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {([
            { k: "switch", label: "스위치" },
            { k: "outlet", label: "콘센트" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm",
                tab === t.k ? "bg-white shadow-sm font-medium" : "text-slate-500"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={addSpec} className="btn-primary" aria-label="추가">
            <Plus size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}
      {!loading && grouped.length === 0 && (
        <p className="text-sm text-slate-400">등록된 항목이 없습니다.</p>
      )}

      <div className="space-y-4">
        {grouped.map(([space, list]) => (
          <section key={space}>
            <h3 className="section-title mb-2">{space}</h3>
            <ul className="space-y-2">
              {list.map((s) => {
                const open = openId === s.id;
                const sAttachments = attachments.filter((a) => a.ref_type === "switch_spec" && a.ref_id === s.id);
                return (
                  <li key={s.id} className="card p-3">
                    <button onClick={() => setOpenId(open ? null : s.id)} className="w-full text-left flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{s.brand_line ?? "-"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.spec_detail ?? ""} {s.quantity ? `· ${s.quantity}개` : ""}
                        </p>
                        {s.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusTag status={s.status} />
                        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>
                    {open && (
                      <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
                        {s.product_url && (
                          <a
                            href={s.product_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-700"
                          >
                            제품 페이지 열기 <ExternalLink size={14} />
                          </a>
                        )}
                        <div>
                          <p className="section-title mb-2">샘플/설치 사진</p>
                          <FileUpload
                            projectId={projectId}
                            refType="switch_spec"
                            refId={s.id}
                            attachments={sAttachments}
                            onChange={(next) => {
                              const other = attachments.filter((a) => !(a.ref_type === "switch_spec" && a.ref_id === s.id));
                              setAttachments([...other, ...next]);
                            }}
                            canDelete={(a) => isAdmin || a.uploaded_by === me?.id}
                          />
                        </div>
                        <div className="flex gap-2">
                          {(["pending", "ordered", "installed"] as SpecStatus[]).map((st) => (
                            <button
                              key={st}
                              disabled={!isAdmin}
                              onClick={() => setStatus(s, st)}
                              className={cn(
                                "flex-1 text-xs py-1.5 rounded-lg border",
                                s.status === st
                                  ? "bg-blue-700 text-white border-blue-700"
                                  : "bg-white text-slate-600 border-slate-200 disabled:opacity-60"
                              )}
                            >
                              {st === "pending" ? "예정" : st === "ordered" ? "발주" : "설치"}
                            </button>
                          ))}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button onClick={() => editSpec(s)} className="btn-outline">편집</button>
                            <button
                              onClick={() => deleteSpec(s)}
                              className="rounded-xl px-3 py-2 text-sm bg-rose-50 text-rose-700"
                            >
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
          </section>
        ))}
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: SpecStatus }) {
  const tone =
    status === "installed" ? "badge-green" : status === "ordered" ? "badge-amber" : "badge-slate";
  const label = status === "installed" ? "설치됨" : status === "ordered" ? "발주됨" : "예정";
  return <span className={cn("badge", tone)}>{label}</span>;
}
