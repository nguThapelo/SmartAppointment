import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { cx } from "@/lib/format";

export function Spinner({ className = "size-5", label }: { className?: string; label?: string }) {
  return (
    <svg className={cx("animate-spin text-current", className)} viewBox="0 0 24 24" fill="none" role={label ? "status" : undefined} aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-ink-500" role="status">
      <Spinner />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-ink-100", className)} aria-hidden />;
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-ink-300">{icon ?? <Inbox className="size-10" />}</div>
      <p className="font-medium text-ink-700">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Inline error. Shows the user-safe message only — never stack traces. */
export function ErrorNote({ message, requestId, className }: { message: string; requestId?: string; className?: string }) {
  return (
    <div role="alert" className={cx("flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800", className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>
        {message}
        {requestId && <span className="block text-xs text-red-600/70">Reference: {requestId}</span>}
      </div>
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={cx("rounded-lg border px-3 py-2 text-sm", tones[tone])}>{children}</div>;
}
