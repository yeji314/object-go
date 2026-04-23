import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  pending: "badge-slate",
  in_progress: "badge-blue",
  done: "badge-green",
  decided: "badge-blue",
  confirmed: "badge-green",
  ordered: "badge-amber",
  installed: "badge-green",
  active: "badge-blue",
  completed: "badge-green",
  paused: "badge-amber",
};

const labels: Record<string, string> = {
  pending: "예정",
  in_progress: "진행중",
  done: "완료",
  decided: "선택됨",
  confirmed: "확정",
  ordered: "발주됨",
  installed: "설치됨",
  active: "진행중",
  completed: "완료",
  paused: "일시정지",
};

export function StatusBadge({ status, labelOverride }: { status: string; labelOverride?: string }) {
  return <span className={cn("badge", tones[status] ?? "badge-slate")}>{labelOverride ?? labels[status] ?? status}</span>;
}
