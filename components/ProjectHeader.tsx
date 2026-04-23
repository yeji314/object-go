"use client";

import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ProjectHeader({
  title,
  subtitle,
  adminLink,
}: {
  title: string;
  subtitle?: string;
  adminLink?: string;
}) {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="mx-auto max-w-xl flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {adminLink && (
            <Link href={adminLink} className="btn-ghost" aria-label="관리자">
              <Settings size={18} />
            </Link>
          )}
          <button className="btn-ghost" onClick={signOut} aria-label="로그아웃">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
