"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="card p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold">비밀번호 설정</h1>
        <p className="text-sm text-slate-500 mt-1">최초 로그인 시 새 비밀번호로 변경해 주세요.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-slate-600">새 비밀번호 (8자 이상)</label>
          <input type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600">비밀번호 확인</label>
          <input type="password" required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "저장 중…" : "비밀번호 저장"}
        </button>
      </form>
    </div>
  );
}
