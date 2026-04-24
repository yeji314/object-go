"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, CostItem, Profile, Project } from "@/lib/types/database";
import { CommentThread } from "@/components/CommentThread";
import { FileUpload } from "@/components/FileUpload";
import { PendingPhotoPicker } from "@/components/PendingPhotoPicker";
import { uploadPendingPhotos } from "@/lib/attachments";
import { cn, formatKrw } from "@/lib/utils";
import { ChevronDown, ChevronUp, Pencil, Plus, Search, Trash2 } from "lucide-react";

type EditForm = {
  category: string;
  item_name: string;
  spec: string;
  unit: string;
  quantity: string;
  unit_price: string;
  sort_order: string;
};

const DRAFT_ID = "__new__";

const emptyForm = (): EditForm => ({
  category: "",
  item_name: "",
  spec: "",
  unit: "",
  quantity: "",
  unit_price: "",
  sort_order: "0",
});

function toForm(i: CostItem): EditForm {
  return {
    category: i.category,
    item_name: i.item_name,
    spec: i.spec ?? "",
    unit: i.unit ?? "",
    quantity: i.quantity != null ? String(i.quantity) : "",
    unit_price: i.unit_price != null ? String(i.unit_price) : "",
    sort_order: String(i.sort_order ?? 0),
  };
}

function fromForm(f: EditForm) {
  return {
    category: f.category.trim(),
    item_name: f.item_name.trim(),
    spec: f.spec.trim() || null,
    unit: f.unit.trim() || null,
    quantity: f.quantity ? Number(f.quantity) : null,
    unit_price: f.unit_price ? Number(f.unit_price) : null,
    sort_order: f.sort_order ? Number(f.sort_order) : 0,
  };
}

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
      const [{ data: prj }, { data: ci }, { data: at }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase
          .from("cost_items")
          .select("*")
          .eq("project_id", projectId)
          .order("category")
          .order("sort_order"),
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cost_items", filter: `project_id=eq.${projectId}` },
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

  function startNew() {
    setEditForm(emptyForm());
    setPendingPhotos([]);
    setEditingId(DRAFT_ID);
    setFormError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(it: CostItem) {
    setEditForm(toForm(it));
    setPendingPhotos([]);
    setEditingId(it.id);
    setOpenId(it.id);
    setFormError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setPendingPhotos([]);
    setFormError(null);
  }

  async function saveEdit() {
    if (!editForm.category.trim() || !editForm.item_name.trim()) {
      setFormError("공종과 항목명은 필수입니다.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = fromForm(editForm);
    try {
      let savedId: string | null = null;
      if (editingId === DRAFT_ID) {
        const { data, error } = await supabase
          .from("cost_items")
          .insert({ project_id: projectId, ...payload })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const inserted = data as unknown as CostItem;
          savedId = inserted.id;
          setItems((xs) => [...xs, inserted]);
        }
      } else if (editingId) {
        const { data, error } = await supabase
          .from("cost_items")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const updated = data as unknown as CostItem;
          savedId = updated.id;
          setItems((xs) => xs.map((x) => (x.id === editingId ? updated : x)));
        }
      }

      if (savedId && pendingPhotos.length > 0) {
        const uploaded = await uploadPendingPhotos(supabase, {
          projectId,
          refType: "cost_item",
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

  async function saveMemo(item: CostItem, memo: string) {
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, memo } : x)));
    await supabase.from("cost_items").update({ memo }).eq("id", item.id);
  }

  async function deleteItem(item: CostItem) {
    if (!window.confirm("이 항목을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("cost_items").delete().eq("id", item.id);
    if (error) return alert(error.message);
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    if (editingId === item.id) setEditingId(null);
    if (openId === item.id) setOpenId(null);
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
            <div className="mt-1 text-xs text-slate-500">
              예산 {formatKrw(budget)} 대비 {Math.round(ratio * 100)}%
            </div>
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
        {isAdmin && !isDrafting && (
          <button onClick={startNew} className="btn-primary shrink-0" aria-label="항목 추가">
            <Plus size={16} className="mr-1" /> 새 항목
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중…</p>}

      {isDrafting && (
        <div className="card p-4 border-2 border-blue-300">
          <p className="section-title mb-3">새 내역 항목</p>
          <EditFormFields form={editForm} onChange={setEditForm} />
          <div className="mt-4">
            <p className="section-title mb-2">사진 (저장 시 업로드)</p>
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
                    const isEditingThis = editingId === it.id;
                    const itAttachments = attachments.filter((a) => a.ref_type === "cost_item" && a.ref_id === it.id);

                    return (
                      <li key={it.id} className={cn("px-4 py-3", isEditingThis && "bg-blue-50/40")}>
                        {isEditingThis ? (
                          <div className="space-y-3">
                            <p className="section-title">항목 편집</p>
                            <EditFormFields form={editForm} onChange={setEditForm} />
                            <div>
                              <p className="section-title mb-2">추가할 사진 (저장 시 업로드)</p>
                              <PendingPhotoPicker files={pendingPhotos} onChange={setPendingPhotos} />
                              <p className="mt-2 text-[11px] text-slate-400">기존 사진은 편집 취소 후 상세 화면에서 관리할 수 있습니다.</p>
                            </div>
                            {formError && <p className="text-sm text-rose-600">{formError}</p>}
                            <div className="flex gap-2">
                              <button onClick={cancelEdit} className="btn-outline flex-1">취소</button>
                              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                                {saving ? "저장 중…" : "저장"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                                      const other = attachments.filter(
                                        (a) => !(a.ref_type === "cost_item" && a.ref_id === it.id)
                                      );
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
                                    <button onClick={() => startEdit(it)} className="btn-outline">
                                      <Pencil size={14} className="mr-1" /> 편집
                                    </button>
                                    <button
                                      onClick={() => deleteItem(it)}
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
              )}
            </div>
          );
        })}
      </div>

      {!loading && filteredGroups.length === 0 && !isDrafting && (
        <p className="text-sm text-slate-400">등록된 내역이 없습니다.</p>
      )}
    </div>
  );
}

function EditFormFields({ form, onChange }: { form: EditForm; onChange: (f: EditForm) => void }) {
  const qty = Number(form.quantity) || 0;
  const price = Number(form.unit_price) || 0;
  const lineTotal = qty * price;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="공종 *">
          <input
            className="input"
            placeholder="예: 가구공사, 목공사"
            value={form.category}
            onChange={(e) => onChange({ ...form, category: e.target.value })}
          />
        </Field>
        <Field label="정렬 순서">
          <input
            type="number"
            inputMode="numeric"
            className="input"
            value={form.sort_order}
            onChange={(e) => onChange({ ...form, sort_order: e.target.value })}
          />
        </Field>
      </div>

      <Field label="항목명 *">
        <input
          className="input"
          placeholder="예: 싱크대 하부장"
          value={form.item_name}
          onChange={(e) => onChange({ ...form, item_name: e.target.value })}
        />
      </Field>

      <Field label="규격">
        <input
          className="input"
          placeholder="예: 600/600각, 라우체"
          value={form.spec}
          onChange={(e) => onChange({ ...form, spec: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="단위">
          <input
            className="input"
            placeholder="예: EA, m, PY"
            value={form.unit}
            onChange={(e) => onChange({ ...form, unit: e.target.value })}
          />
        </Field>
        <Field label="수량">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            className="input"
            value={form.quantity}
            onChange={(e) => onChange({ ...form, quantity: e.target.value })}
          />
        </Field>
        <Field label="단가 (원)">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="input"
            value={form.unit_price}
            onChange={(e) => onChange({ ...form, unit_price: e.target.value })}
          />
        </Field>
      </div>

      <div className="rounded-xl bg-slate-50 px-3 py-2 flex items-baseline justify-between text-sm">
        <span className="text-slate-500">합계</span>
        <span className="font-semibold">{formatKrw(lineTotal)}</span>
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
