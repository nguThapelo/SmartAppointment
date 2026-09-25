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
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="Appointment Hub home">
      <LogoMark />
      <span className={cx("font-[family-name:var(--font-display)] text-[18px] font-bold tracking-tight", tone === "light" ? "text-white" : "text-ink-900")}>
        Appointment
        <span className={cx("ml-1 bg-clip-text text-transparent", tone === "light" ? "bg-gradient-to-r from-brand-300 to-cyan-300" : "bg-brand-gradient")}>Hub</span>
      </span>
    </Link>
  );
}
