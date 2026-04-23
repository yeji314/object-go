"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, X } from "lucide-react";

type Client = { id: string; name: string; email: string };

export function NewProjectButton({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    title: "",
    address: "",
    total_budget: "",
    start_date: "",
    end_date: "",
  });

  async function create() {
    if (!form.client_id || !form.title) {
      setError("고객과 공사명을 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: insErr } = await supabase
      .from("projects")
      .insert({
        client_id: form.client_id,
        title: form.title,
        address: form.address || null,
        total_budget: form.total_budget ? Number(form.total_budget) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })
      .select()
      .single();
    setLoading(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (data) {
      setOpen(false);
      router.push(`/admin/project/${data.id}`);
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} className="mr-1" /> 새 프로젝트
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">새 프로젝트</h3>
              <button onClick={() => setOpen(false)} className="btn-ghost">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm mb-1 text-slate-600">고객</label>
                <select
                  className="input"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                >
                  <option value="">-- 고객 선택 --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="text-xs text-rose-600 mt-1">먼저 고객 페이지에서 고객 계정을 생성해 주세요.</p>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-600">공사명</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-600">주소</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-600">총 계약금액 (원)</label>
                <input
                  type="number"
                  className="input"
                  value={form.total_budget}
                  onChange={(e) => setForm({ ...form, total_budget: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1 text-slate-600">착공</label>
                  <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-slate-600">준공</label>
                  <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button onClick={create} disabled={loading} className="btn-primary w-full">
                {loading ? "생성 중…" : "프로젝트 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
