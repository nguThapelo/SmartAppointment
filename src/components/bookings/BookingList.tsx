"use client";

import Link from "next/link";
import { ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { money, timeOnly } from "@/lib/format";
import type { BookingDTO } from "./types";

const AVATAR_TONES = ["from-brand-400 to-cyan-500", "from-accent-400 to-fuchsia-500", "from-sky-400 to-blue-600", "from-amber-400 to-orange-500", "from-rose-400 to-pink-600"];
const toneFor = (name: string) => AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function BookingList({
  bookings, tz, showCustomer = false, empty = "No bookings yet",
}: { bookings: BookingDTO[]; tz: string; showCustomer?: boolean; empty?: string }) {
  if (!bookings.length) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y divide-ink-100">
      {bookings.map((b) => {
        const person = showCustomer ? b.customer.name : b.provider.name;
        const d = new Date(b.startsAt);
        return (
          <li key={b.id}>
            <Link href={`/bookings/${b.reference}`} className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/40 sm:gap-4 sm:px-5">
              <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-gradient opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              {/* Calendar tile */}
              <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-white py-1.5 text-center shadow-soft ring-1 ring-ink-200/70">
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600">
                  {new Intl.DateTimeFormat("en-ZA", { month: "short", timeZone: tz }).format(d)}
                </span>
                <span className="font-[family-name:var(--font-display)] text-lg font-bold leading-none text-ink-900">
                  {new Intl.DateTimeFormat("en-ZA", { day: "numeric", timeZone: tz }).format(d)}
                </span>
                <span className="text-[10px] text-ink-400">{timeOnly(b.startsAt, tz)}</span>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className={`hidden size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${toneFor(person)} text-xs font-semibold text-white sm:grid`} aria-hidden>
                  {initials(person)}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-ink-900">
                    {b.serviceName}
                    {b.channel === "WHATSAPP" && (
                      <Tooltip label="Booked on WhatsApp">
                        <MessageCircle className="size-3.5 text-emerald-600" aria-label="Booked on WhatsApp" />
                      </Tooltip>
                    )}
                    {b.channel === "AGENT" && (
                      <Tooltip label="Booked with the AI assistant">
                        <Sparkles className="size-3.5 text-accent-500" aria-label="Booked with the AI assistant" />
                      </Tooltip>
                    )}
                  </p>
                  <p className="truncate text-sm text-ink-500">
                    {showCustomer ? person : `with ${person}`} · <span className="font-mono text-xs">{b.reference}</span>
                  </p>
                  <div className="mt-1 sm:hidden"><StatusBadge status={b.status} /></div>
                </div>
              </div>

              <div className="hidden text-right text-sm font-semibold text-ink-800 sm:block">{money(b.priceCents, b.currency)}</div>
              <div className="hidden sm:block"><StatusBadge status={b.status} /></div>
              <ChevronRight className="hidden size-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600 sm:block" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
