// Display helpers shared by server and client components.

export const DEFAULT_TZ = "Africa/Johannesburg";

export function money(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100);
}

export function dateTime(iso: string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  }).format(new Date(iso));
}

export function dateOnly(iso: string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(iso));
}

export function shortDate(iso: string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));
}

export function timeOnly(iso: string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));
}

export function relative(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** YYYY-MM-DD of "today + n days" in a timezone. */
export function isoDate(daysFromNow = 0, tz = DEFAULT_TZ) {
  const d = new Date(Date.now() + daysFromNow * 86400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting approval",
  APPROVED: "Confirmed",
  DECLINED: "Declined",
  PAYMENT_PENDING: "Awaiting payment",
  PAID: "Paid",
  PAYMENT_FAILED: "Payment failed",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  APPROVED: "info",
  PAYMENT_PENDING: "warning",
  PAID: "success",
  PAYMENT_FAILED: "danger",
  COMPLETED: "brand",
  CLOSED: "neutral",
  DECLINED: "danger",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
