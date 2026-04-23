"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  const items = [
    { href: "/admin", label: "프로젝트" },
    { href: "/admin/clients", label: "고객" },
  ];
  return (
    <nav className="flex items-center gap-2 text-sm">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "px-3 py-1.5 rounded-full",
            (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href))
              ? "bg-blue-700 text-white"
              : "text-slate-700 hover:bg-slate-100"
          )}
        >
          {i.label}
        </Link>
      ))}
      <span className="hidden sm:inline text-xs text-slate-400 ml-2">{email}</span>
      <button onClick={signOut} className="btn-ghost" aria-label="로그아웃">
        <LogOut size={16} />
      </button>
    </nav>
  );
}
