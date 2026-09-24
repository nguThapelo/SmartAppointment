"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Clock, MessageCircle, UserRound } from "lucide-react";
import type { Role } from "@prisma/client";
import { BookingActions } from "@/components/bookings/BookingActions";
import { ChatPanel, FeedbackPanel, FilesPanel, HistoryPanel, PaymentPanel, RescheduleButton } from "@/components/bookings/BookingPanels";
import type { BookingDTO } from "@/components/bookings/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorNote, Loading, Notice } from "@/components/ui/feedback";
import { api, ApiError, errorMessage } from "@/lib/api";
import { dateOnly, money, timeOnly } from "@/lib/format";

export function BookingDetail({ reference, role, tz }: { reference: string; role: Role; tz: string }) {
  const paymentReturn = useSearchParams().get("payment");
  const q = useQuery({
    queryKey: ["booking", reference],
    queryFn: () => api<BookingDTO>(`/api/bookings/${encodeURIComponent(reference)}`),
    // After returning from Stripe, poll until the webhook has updated the booking.
    refetchInterval: (query) => (paymentReturn === "returned" && query.state.data?.status === "PAYMENT_PENDING" ? 3000 : false),
  });

  if (q.isPending) return <Loading label="Loading booking" />;
  if (q.error) {
    return q.error instanceof ApiError && q.error.status === 404 ? (
      <EmptyState title="Booking not found" action={<Link href="/bookings" className="text-sm text-brand-700 hover:underline">Back to bookings</Link>}>
        It doesn’t exist or you don’t have access to it.
      </EmptyState>
    ) : (
      <ErrorNote message={errorMessage(q.error)} />
    );
  }

  const b = q.data;
  const isStaff = role === "PROVIDER" || role === "ADMIN";
  const isCustomer = role === "CLIENT";

  return (
    <div className="space-y-6">
      <Link href="/bookings" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" /> Bookings
      </Link>

      {paymentReturn === "returned" && b.status === "PAYMENT_PENDING" && (
        <Notice>Thanks! We’re confirming your payment with Stripe — this page updates automatically.</Notice>
      )}
      {paymentReturn === "returned" && b.status === "PAID" && <Notice tone="success">Payment received. You’re all set.</Notice>}
      {paymentReturn === "cancelled" && <Notice tone="warning">Payment was cancelled. You can try again below.</Notice>}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{b.serviceName}</h1>
            <StatusBadge status={b.status} />
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            {b.reference}
            {b.channel === "WHATSAPP" && <span className="inline-flex items-center gap-1 text-emerald-700"><MessageCircle className="size-3.5" /> WhatsApp</span>}
            {b.channel === "AGENT" && <span className="inline-flex items-center gap-1 text-brand-700"><Bot className="size-3.5" /> Assistant</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RescheduleButton booking={b} tz={tz} isCustomer={isCustomer} />
          <BookingActions booking={b} isStaff={isStaff} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Detail icon={<Clock className="size-4" />} label="When">
                {dateOnly(b.startsAt, tz)}
                <br />
                {timeOnly(b.startsAt, tz)} – {timeOnly(b.endsAt, tz)}
              </Detail>
              <Detail icon={<UserRound className="size-4" />} label={isStaff ? "Customer" : "Provider"}>
                {isStaff ? b.customer.name : b.provider.name}
                {isStaff && (b.customer.email || b.customer.phone) && (
                  <span className="block text-ink-500">{b.customer.email ?? b.customer.phone}</span>
                )}
              </Detail>
              <Detail label="Price">{money(b.priceCents, b.currency)} · {b.paymentMode === "ON_SITE" ? "paid on site" : "paid online"}</Detail>
              {b.notes && (
                <Detail label="Notes">
                  {/* User-supplied text: rendered as text, never HTML. */}
                  <span className="whitespace-pre-wrap">{b.notes}</span>
                </Detail>
              )}
              {b.declineReason && <Detail label="Decline reason">{b.declineReason}</Detail>}
              {b.cancelReason && <Detail label="Cancellation reason">{b.cancelReason}</Detail>}
            </CardBody>
          </Card>
          <ChatPanel booking={b} canPost={role !== "ADMIN"} />
          <FeedbackPanel booking={b} />
        </div>
        <div className="space-y-6">
          <PaymentPanel booking={b} isCustomer={isCustomer} />
          <FilesPanel booking={b} />
          <HistoryPanel booking={b} tz={tz} />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">{icon}{label}</p>
      <p className="mt-1 text-sm text-ink-800">{children}</p>
    </div>
  );
}
