import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({ children, className, interactive }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-[var(--radius-card)] border border-ink-200/70 bg-white shadow-card",
        interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-lift",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, icon }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-7 flex animate-fade-up flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </header>
  );
}

type StatTone = "brand" | "accent" | "sky" | "amber";
const STAT_TONE: Record<StatTone, string> = {
  brand: "bg-brand-gradient shadow-glow",
  accent: "bg-accent-gradient shadow-glow-accent",
  sky: "bg-gradient-to-br from-sky-500 to-blue-600 shadow-[0_8px_24px_-6px_rgb(2_132_199/0.45)]",
  amber: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_8px_24px_-6px_rgb(245_158_11/0.45)]",
};

export function Stat({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: StatTone }) {
  return (
    <Card interactive className="relative overflow-hidden px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-bold leading-none tracking-tight text-ink-900">{value}</p>
          {hint && <p className="mt-2 text-xs text-ink-400">{hint}</p>}
        </div>
        {icon && <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl text-white", STAT_TONE[tone])}>{icon}</span>}
      </div>
    </Card>
  );
}
