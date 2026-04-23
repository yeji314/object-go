"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }
    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.must_change_password === true) {
      router.replace("/set-password");
      return;
    }
    const next = params.get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="card p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">인테리어 공사 현황</h1>
        <p className="text-sm text-slate-500 mt-1">이메일과 비밀번호로 로그인하세요.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1 text-slate-600">이메일</label>
          <input
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600">비밀번호</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        <Link href="/forgot" className="text-blue-700 hover:underline">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-sm">로딩 중…</div>}>
      <LoginForm />
    </Suspense>
  );
}
