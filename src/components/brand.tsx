import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { cx } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow", className)}>
      <CalendarCheck2 className="size-5" aria-hidden />
    </span>
  );
}

export function Logo({ href = "/", tone = "dark" }: { href?: string; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="SmartAppointment home">
      <LogoMark />
      <span className="leading-none">
        <span className={cx("block text-[10px] font-bold uppercase tracking-[0.2em]", tone === "light" ? "text-brand-300" : "text-brand-600")}>Smart</span>
        <span className={cx("block font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight", tone === "light" ? "text-white" : "text-ink-900")}>
          Appointment
        </span>
      </span>
    </Link>
  );
}
