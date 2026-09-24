import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { cx } from "@/lib/format";

export function Spinner({ className = "size-5", label }: { className?: string; label?: string }) {
  return (
    <svg className={cx("animate-spin text-current", className)} viewBox="0 0 24 24" fill="none" role={label ? "status" : undefined} aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Three bouncing brand dots — friendlier than a bare spinner for page loads. */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-ink-500" role="status">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 animate-bounce rounded-full bg-brand-gradient" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-xl", className)} aria-hidden />;
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="relative mb-2">
        <div className="absolute inset-0 rounded-full bg-brand-200/40 blur-xl" aria-hidden />
        <div className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-white to-ink-50 text-brand-500 shadow-card ring-1 ring-ink-200/70">
          {icon ?? <Inbox className="size-7" />}
        </div>
      </div>
      <p className="font-[family-name:var(--font-display)] font-semibold text-ink-800">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Inline error. Shows the user-safe message only — never stack traces. */
export function ErrorNote({ message, requestId, className }: { message: string; requestId?: string; className?: string }) {
  return (
    <div role="alert" className={cx("flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-sm text-rose-800", className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>
        {message}
        {requestId && <span className="block text-xs text-rose-600/70">Reference: {requestId}</span>}
      </div>
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" }) {
  const tones = {
    info: "border-sky-200 bg-sky-50/80 text-sky-900",
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    warning: "border-amber-200 bg-amber-50/80 text-amber-900",
  };
  return <div className={cx("rounded-xl border px-3.5 py-2.5 text-sm", tones[tone])}>{children}</div>;
}
