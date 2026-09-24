import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/format";
import { Spinner } from "./feedback";
import { Tooltip } from "./tooltip";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ai" | "dark";
type Size = "sm" | "md" | "lg";

// Gradient primaries carry a brand-tinted glow; hover deepens the gradient and
// lifts the button a pixel, active presses it back down (peach-payment style).
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-gradient text-white shadow-glow hover:-translate-y-px hover:shadow-[0_14px_30px_-8px_rgb(19_168_142/0.55)] hover:brightness-105 active:translate-y-0 disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0",
  ai:
    "bg-accent-gradient text-white shadow-glow-accent hover:-translate-y-px hover:brightness-110 active:translate-y-0 disabled:opacity-60 disabled:shadow-none",
  dark: "bg-ink-900 text-white shadow-card hover:-translate-y-px hover:bg-ink-800 hover:shadow-lift active:translate-y-0 disabled:opacity-60",
  secondary:
    "bg-white text-ink-800 ring-1 ring-inset ring-ink-200 shadow-soft hover:-translate-y-px hover:ring-ink-300 hover:shadow-card active:translate-y-0 disabled:text-ink-400 disabled:shadow-none disabled:hover:translate-y-0",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300",
  danger:
    "bg-white text-red-600 ring-1 ring-inset ring-red-200 shadow-soft hover:-translate-y-px hover:bg-red-50 hover:ring-red-300 active:translate-y-0 disabled:text-red-300",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

const base =
  "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 ease-out disabled:cursor-not-allowed";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button — prevents double submits. */
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, icon, disabled, children, className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(base, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  href, variant = "primary", size = "md", icon, children, className,
}: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx(base, VARIANTS[variant], SIZES[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

/** Round icon-only button with an accessible name and a matching tooltip. */
export function IconButton({
  label, icon, onClick, tone = "default", side = "top", loading, disabled, type = "button", className,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  tone?: "default" | "light" | "danger" | "brand";
  side?: "top" | "bottom" | "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const tones = {
    default: "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
    light: "text-white/60 hover:bg-white/10 hover:text-white",
    danger: "text-ink-400 hover:bg-red-50 hover:text-red-600",
    brand: "bg-brand-gradient text-white shadow-glow hover:brightness-110",
  };
  return (
    <Tooltip label={label} side={side}>
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={label}
        className={cx("grid size-9 place-items-center rounded-xl transition-all duration-150 disabled:opacity-50", tones[tone], className)}
      >
        {loading ? <Spinner className="size-4" /> : icon}
      </button>
    </Tooltip>
  );
}
