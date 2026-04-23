import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKrw(value?: number | null) {
  if (value == null) return "-";
  return `${value.toLocaleString("ko-KR")}원`;
}

export function daysBetween(a: string | Date, b: string | Date) {
  const da = new Date(a);
  const db = new Date(b);
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function daysUntil(target?: string | null) {
  if (!target) return null;
  return daysBetween(new Date(), target);
}

export function weekdayKr(date: string | Date) {
  const d = new Date(date);
  return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
}

export function formatDateKr(date?: string | Date | null) {
  if (!date) return "-";
  const d = new Date(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function deadlineTone(deadline?: string | null): "danger" | "warning" | "muted" {
  const d = daysUntil(deadline);
  if (d == null) return "muted";
  if (d <= 3) return "danger";
  if (d <= 7) return "warning";
  return "muted";
}
