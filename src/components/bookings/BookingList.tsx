"use client";

import Link from "next/link";
import { ChevronRight, MessageCircle, Bot } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { money, shortDate, timeOnly } from "@/lib/format";
import type { BookingDTO } from "./types";

export function BookingList({
  bookings, tz, showCustomer = false, empty = "No bookings yet",
}: { bookings: BookingDTO[]; tz: string; showCustomer?: boolean; empty?: string }) {
  if (!bookings.length) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y divide-ink-100">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link href={`/bookings/${b.reference}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:gap-4 sm:px-5">
            <div className="w-20 shrink-0 text-sm sm:w-24">
              <p className="font-medium text-ink-900">{shortDate(b.startsAt, tz)}</p>
              <p className="text-ink-500">{timeOnly(b.startsAt, tz)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium text-ink-900">
                {b.serviceName}
                {b.channel === "WHATSAPP" && <MessageCircle className="size-3.5 text-emerald-600" aria-label="Booked on WhatsApp" />}
                {b.channel === "AGENT" && <Bot className="size-3.5 text-brand-600" aria-label="Booked with the assistant" />}
              </p>
              <p className="truncate text-sm text-ink-500">
                {showCustomer ? b.customer.name : `with ${b.provider.name}`} · {b.reference}
              </p>
              <div className="mt-1 sm:hidden"><StatusBadge status={b.status} /></div>
            </div>
            <div className="hidden text-right text-sm text-ink-600 sm:block">{money(b.priceCents, b.currency)}</div>
            <div className="hidden sm:block"><StatusBadge status={b.status} /></div>
            <ChevronRight className="hidden size-4 shrink-0 text-ink-300 sm:block" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
