import type { ReactNode } from "react";
import { cx, STATUS_LABEL, STATUS_TONE, type Tone } from "@/lib/format";

// Soft, pill-shaped chips with a status dot (MUI Chip-like).
const TONES: Record<Tone, { chip: string; dot: string }> = {
  neutral: { chip: "bg-ink-100 text-ink-600 ring-ink-200/80", dot: "bg-ink-400" },
  info: { chip: "bg-sky-50 text-sky-700 ring-sky-200/80", dot: "bg-sky-500" },
  success: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200/80", dot: "bg-emerald-500" },
  warning: { chip: "bg-amber-50 text-amber-800 ring-amber-200/80", dot: "bg-amber-500" },
  danger: { chip: "bg-rose-50 text-rose-700 ring-rose-200/80", dot: "bg-rose-500" },
  brand: { chip: "bg-brand-50 text-brand-700 ring-brand-200/80", dot: "bg-brand-500" },
};

export function Badge({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  const t = TONES[tone];
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", t.chip)}>
      {dot && <span className={cx("size-1.5 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
