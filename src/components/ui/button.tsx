import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/format";
import { Spinner } from "./feedback";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/60",
  secondary: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50 disabled:text-red-300",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

const base =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap";

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
