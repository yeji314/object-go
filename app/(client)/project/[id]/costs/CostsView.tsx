"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, CostItem, Profile, Project } from "@/lib/types/database";
import { CommentThread } from "@/components/CommentThread";
import { FileUpload } from "@/components/FileUpload";
import { cn, formatKrw } from "@/lib/utils";
import { ChevronDown, ChevronUp, Plus, Search, Trash2 } from "lucide-react";

export function CostsView({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<CostItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
        if (active && p) setMe(p as unknown as Profile);
      }
      const [{ data: prj }, { data: ci }, { data: at }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("cost_items").select("*").eq("project_id", projectId).order("category").order("sort_order"),
        supabase.from("attachments").select("*").eq("project_id", projectId).eq("ref_type", "cost_item"),
      ]);
      if (!active) return;
      setProject((prj as unknown as Project) ?? null);
      setItems((ci ?? []) as unknown as CostItem[]);
      setAttachments((at ?? []) as unknown as Attachment[]);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel(`costs-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cost_items", filter: `project_id=eq.${projectId}` }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [projectId, supabase]);

  const isAdmin = me?.role === "admin";

  const filteredGroups = useMemo(() => {
    const q = query.trim();
    const filtered = items.filter(
      (i) => !q || i.category.includes(q) || i.item_name.includes(q) || (i.spec ?? "").includes(q)
    );
    const groups = new Map<string, CostItem[]>();
    for (const it of filtered) {
      if (!groups.has(it.category)) groups.set(it.category, []);
      groups.get(it.category)!.push(it);
    }
    return Array.from(groups.entries()).map(([cat, list]) => ({
      category: cat,
      items: list,
      subtotal: list.reduce((acc, i) => acc + (Number(i.total_price) || 0), 0),
    }));
  }, [items, query]);

  const grandTotal = items.reduce((acc, i) => acc + (Number(i.total_price) || 0), 0);
  const budget = project?.total_budget ?? 0;
  const ratio = budget > 0 ? Math.min(1, grandTotal / budget) : 0;

  async function saveMemo(item: CostItem, memo: string) {
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, memo } : x)));
    await supabase.from("cost_items").update({ memo }).eq("id", item.id);
  }

  async function addItem() {
    const category = prompt("공종 (예: 가구공사)");
    if (!category) return;
    const item_name = prompt("항목명");
    if (!item_name) return;
    const spec = prompt("규격 (선택)") || null;
    const unit = prompt("단위 (선택, 예: EA)") || null;
    const quantity = Number(prompt("수량 (선택)") || "0");
    const unit_price = Number(prompt("단가 (원, 선택)") || "0");
    const { data, error } = await supabase
      .from("cost_items")
      .insert({ project_id: projectId, category, item_name, spec, unit, quantity, unit_price })
      .select()
      .single();
    if (error) return alert(error.message);
    if (data) setItems((xs) => [...xs, data as unknown as CostItem]);
  }

  async function editItem(item: CostItem) {
    const item_name = prompt("항목명", item.item_name) ?? item.item_name;
    const spec = prompt("규격", item.spec ?? "") ?? item.spec;
    const unit = prompt("단위", item.unit ?? "") ?? item.unit;
    const quantity = Number(prompt("수량", String(item.quantity ?? 0)) || "0");
    const unit_price = Number(prompt("단가 (원)", String(item.unit_price ?? 0)) || "0");
    const patch = { item_name, spec, unit, quantity, unit_price };
    const { data, error } = await supabase.from("cost_items").update(patch).eq("id", item.id).select().single();
    if (error) return alert(error.message);
    if (data) setItems((xs) => xs.map((x) => (x.id === item.id ? (data as unknown as CostItem) : x)));
  }

  async function deleteItem(item: CostItem) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("cost_items").delete().eq("id", item.id);
    if (error) return alert(error.message);
    setItems((xs) => xs.filter((x) => x.id !== item.id));
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <span className="section-title">총합계</span>
          <span className="text-lg font-semibold">{formatKrw(grandTotal)}</span>
        </div>
        {budget > 0 && (
          <>
            <div className="mt-1 text-xs text-slate-500">예산 {formatKrw(budget)} 대비 {Math.round(ratio * 100)}%</div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${ratio * 100}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="공종 또는 항목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {isAdmin && (
          <button onClick={addItem} className="btn-primary" aria-label="항목 추가">
            <Plus size={16} />
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}

      <div className="space-y-3">
        {filteredGroups.map((g) => {
          const collapsed = collapsedCats[g.category];
          return (
            <div key={g.category} className="card overflow-hidden">
              <button
                onClick={() => setCollapsedCats((s) => ({ ...s, [g.category]: !collapsed }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  <span className="font-semibold">{g.category}</span>
                  <span className="text-xs text-slate-500">({g.items.length})</span>
                </div>
                <span className="text-sm font-medium">{formatKrw(g.subtotal)}</span>
              </button>
              {!collapsed && (
                <ul className="divide-y divide-slate-100">
                  {g.items.map((it) => {
                    const open = openId === it.id;
                    const itAttachments = attachments.filter((a) => a.ref_type === "cost_item" && a.ref_id === it.id);
                    return (
                      <li key={it.id} className="px-4 py-3">
                        <button onClick={() => setOpenId(open ? null : it.id)} className="w-full text-left">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{it.item_name}</p>
                              {it.spec && <p className="text-xs text-slate-500 truncate">{it.spec}</p>}
                              <p className="text-xs text-slate-400 mt-0.5">
                                {it.quantity ?? "-"} {it.unit ?? ""} × {formatKrw(it.unit_price)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-semibold">{formatKrw(it.total_price)}</p>
                              <span className="text-xs text-slate-400">{open ? "접기" : "상세"}</span>
                            </div>
                          </div>
                        </button>
                        {open && (
                          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                            <div>
                              <label className="section-title">메모 / 요청사항</label>
                              <textarea
                                className="textarea mt-1"
                                defaultValue={it.memo ?? ""}
                                onBlur={(e) => {
                                  if ((e.target.value || "") !== (it.memo ?? "")) saveMemo(it, e.target.value);
                                }}
                              />
                            </div>
                            <div>
                              <p className="section-title mb-2">시공 사진</p>
                              <FileUpload
                                projectId={projectId}
                                refType="cost_item"
                                refId={it.id}
                                attachments={itAttachments}
                                onChange={(next) => {
                                  const other = attachments.filter((a) => !(a.ref_type === "cost_item" && a.ref_id === it.id));
                                  setAttachments([...other, ...next]);
                                }}
                                canDelete={(a) => isAdmin || a.uploaded_by === me?.id}
                              />
                            </div>
                            <div>
                              <p className="section-title mb-2">소통</p>
                              <CommentThread projectId={projectId} refType="cost_item" refId={it.id} />
                            </div>
                            {isAdmin && (
                              <div className="flex flex-wrap gap-2">
                                <button onClick={() => editItem(it)} className="btn-outline">편집</button>
                                <button
                                  onClick={() => deleteItem(it)}
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
              )}
            </div>
          );
        })}
      </div>

      {!loading && filteredGroups.length === 0 && (
        <p className={cn("text-sm text-slate-400")}>등록된 내역이 없습니다.</p>
      )}
    </div>
  );
}
