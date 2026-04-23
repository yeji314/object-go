"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CheckSquare, Receipt, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; Icon: typeof Home; match?: (p: string) => boolean };

export function BottomNav({ projectId, adminPrefix }: { projectId: string; adminPrefix?: boolean }) {
  const pathname = usePathname();
  const base = adminPrefix ? `/admin/project/${projectId}` : `/project/${projectId}`;

  const items: NavItem[] = [
    { href: base, label: "홈", Icon: Home, match: (p) => p === base },
    { href: `${base}/schedule`, label: "일정", Icon: Calendar },
    { href: `${base}/decisions`, label: "결정", Icon: CheckSquare },
    { href: `${base}/costs`, label: "내역서", Icon: Receipt },
    { href: `${base}/specs`, label: "스위치", Icon: Plug },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-xl grid grid-cols-5">
        {items.map(({ href, label, Icon, match }) => {
          const active = match ? match(pathname) : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center py-2.5 gap-0.5 text-[11px]",
                active ? "text-blue-700" : "text-slate-500"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
