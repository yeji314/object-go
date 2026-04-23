"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Mail } from "lucide-react";

export function CreateClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  async function submit() {
    if (!form.name || !form.email) {
      setError("이름과 이메일을 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "실패");
      setResult({ email: form.email, tempPassword: json.temp_password });
      setForm({ name: "", email: "", phone: "" });
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setResult(null); }} className="btn-primary">
        <Plus size={16} className="mr-1" /> 새 고객
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">새 고객 계정</h3>
            {!result ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm mb-1 text-slate-600">이름</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-slate-600">이메일</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-slate-600">연락처 (선택)</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="btn-outline">취소</button>
                  <button onClick={submit} disabled={loading} className="btn-primary">
                    {loading ? "생성 중…" : "계정 생성"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm">계정이 생성되었습니다. 아래 임시 비밀번호를 고객에게 전달하세요.</p>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div><span className="text-slate-500">이메일:</span> {result.email}</div>
                  {result.tempPassword && (
                    <div className="mt-1">
                      <span className="text-slate-500">임시 비밀번호:</span>{" "}
                      <code className="font-mono">{result.tempPassword}</code>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  고객은 첫 로그인 후 비밀번호를 새로 설정해야 합니다.
                </p>
                <div className="flex justify-end">
                  <button onClick={() => setOpen(false)} className="btn-primary">확인</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ClientListActions({ email }: { email: string }) {
  async function sendReset() {
    if (!confirm(`${email} 에게 비밀번호 재설정 메일을 보낼까요?`)) return;
    const res = await fetch("/api/admin/clients/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await res.json();
    if (!res.ok) return alert(j.error || "실패");
    alert("재설정 메일이 발송되었습니다.");
  }
  return (
    <button onClick={sendReset} className="btn-outline text-xs" aria-label="비밀번호 재설정">
      <Mail size={14} className="mr-1" /> 재설정
    </button>
  );
}
