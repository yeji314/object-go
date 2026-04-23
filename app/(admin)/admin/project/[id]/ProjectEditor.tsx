"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectStatus } from "@/lib/types/database";
import { formatDateKr, formatKrw } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

type ClientInfo = { id: string; name: string; email: string } | null;

export function ProjectEditor({ project, client }: { project: Project; client: ClientInfo }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: project.title,
    address: project.address ?? "",
    total_budget: project.total_budget ?? 0,
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    status: project.status,
  });

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        title: form.title,
        address: form.address || null,
        total_budget: form.total_budget ? Number(form.total_budget) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status as ProjectStatus,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) return alert(error.message);
    setEditing(false);
    router.refresh();
  }

  async function deleteProject() {
    if (!confirm("프로젝트를 삭제하시겠습니까? 관련된 일정·내역·결정이 모두 삭제됩니다.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return alert(error.message);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="card p-5">
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{project.title}</h1>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {client?.name ?? "-"} · {client?.email ?? "-"}
              </p>
              <p className="text-sm text-slate-500">{project.address ?? "주소 미입력"}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setEditing(true)} className="btn-outline">편집</button>
              <button onClick={deleteProject} className="rounded-xl px-3 py-2 text-sm bg-rose-50 text-rose-700">삭제</button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Stat label="착공" value={formatDateKr(project.start_date)} />
            <Stat label="준공" value={formatDateKr(project.end_date)} />
            <Stat label="예산" value={formatKrw(project.total_budget)} />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <Field label="공사명">
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="주소">
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="예산 (원)">
            <input
              type="number"
              className="input"
              value={form.total_budget}
              onChange={(e) => setForm({ ...form, total_budget: Number(e.target.value) })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="착공">
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </Field>
            <Field label="준공">
              <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
          </div>
          <Field label="상태">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
              <option value="active">진행중</option>
              <option value="paused">일시정지</option>
              <option value="completed">완료</option>
            </select>
          </Field>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="btn-outline">취소</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm mb-1 text-slate-600">{label}</span>
      {children}
    </label>
  );
}
