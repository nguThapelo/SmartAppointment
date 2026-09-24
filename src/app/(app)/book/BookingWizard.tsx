"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Search } from "lucide-react";
import { SlotPicker } from "@/components/bookings/SlotPicker";
import type { BookingDTO } from "@/components/bookings/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/api";
import { cx, dateOnly, money, timeOnly } from "@/lib/format";

interface Category {
  id: string;
  name: string;
  description: string | null;
  subServices: { id: string; name: string; description: string | null; providerCount: number }[];
}
interface Option {
  providerServiceId: string;
  providerName: string;
  priceCents: number;
  currency: string;
  durationMin: number;
  paymentMode: "ONLINE" | "ON_SITE";
}

const STEPS = ["Service", "Provider", "Time", "Confirm"];

export function BookingWizard({ tz }: { tz: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState("");
  const [service, setService] = useState<{ id: string; name: string } | null>(null);
  const [option, setOption] = useState<Option | null>(null);
  const [slot, setSlot] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [notes, setNotes] = useState("");
  // One key per attempt: a double click or network retry can't double-book.
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api<{ data: Category[] }>("/api/catalog/categories") });
  const options = useQuery({
    queryKey: ["options", service?.id],
    queryFn: () => api<{ data: Option[] }>(`/api/catalog/sub-services/${service!.id}/providers`),
    enabled: !!service,
  });
  const book = useMutation({
    mutationFn: () =>
      api<BookingDTO>("/api/bookings", {
        body: { providerServiceId: option!.providerServiceId, startsAt: slot!.startsAt, ...(notes.trim() ? { notes: notes.trim() } : {}) },
        idempotencyKey: idemKey,
      }),
    onSuccess: (b) => router.push(`/bookings/${b.reference}?new=1`),
    onError: (err) => {
      // The slot went while they were deciding: send them back to pick again.
      if (err instanceof ApiError && ["SLOT_TAKEN", "SLOT_UNAVAILABLE"].includes(err.code)) {
        setSlot(null);
        setIdemKey(newIdempotencyKey());
        setStep(2);
      }
    },
  });

  const f = filter.trim().toLowerCase();
  const visible = (categories.data?.data ?? [])
    .map((c) => ({ ...c, subServices: c.subServices.filter((s) => s.providerCount > 0 && (!f || `${c.name} ${s.name} ${s.description ?? ""}`.toLowerCase().includes(f))) }))
    .filter((c) => c.subServices.length);

  return (
    <>
      <PageHeader title="Book an appointment" />
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cx("flex items-center gap-2 rounded-full px-3 py-1 text-sm", i === step ? "bg-ink-900 text-white" : i < step ? "bg-brand-50 text-brand-800" : "bg-ink-100 text-ink-500")}>
            {i < step ? <Check className="size-3.5" /> : <span className="text-xs">{i + 1}</span>} {s}
          </li>
        ))}
      </ol>

      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" /> Back
        </button>
      )}

      {step === 0 && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <label htmlFor="service-search" className="sr-only">Search services</label>
            <Input id="service-search" placeholder="Search services…" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
          </div>
          {categories.isPending ? (
            <Loading label="Loading services" />
          ) : categories.error ? (
            <ErrorNote message={errorMessage(categories.error)} />
          ) : !visible.length ? (
            <EmptyState title="No matching services" />
          ) : (
            visible.map((c) => (
              <section key={c.id}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">{c.name}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {c.subServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setService({ id: s.id, name: s.name }); setOption(null); setSlot(null); setStep(1); }}
                      className="rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-400 hover:shadow"
                    >
                      <p className="font-medium text-ink-900">{s.name}</p>
                      {s.description && <p className="mt-0.5 text-sm text-ink-500">{s.description}</p>}
                      <p className="mt-2 text-xs text-ink-400">{s.providerCount} provider{s.providerCount === 1 ? "" : "s"}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {step === 1 && service && (
        <div className="space-y-3">
          <h2 className="font-semibold text-ink-900">Who would you like for your {service.name.toLowerCase()}?</h2>
          {options.isPending ? (
            <Loading />
          ) : options.error ? (
            <ErrorNote message={errorMessage(options.error)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {options.data.data.map((o) => (
                <button
                  key={o.providerServiceId}
                  onClick={() => { setOption(o); setSlot(null); setStep(2); }}
                  className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-400"
                >
                  <div>
                    <p className="font-medium text-ink-900">{o.providerName}</p>
                    <p className="text-sm text-ink-500">{o.durationMin} min · {o.paymentMode === "ON_SITE" ? "pay on site" : "pay online"}</p>
                  </div>
                  <p className="text-lg font-semibold text-ink-900">{money(o.priceCents, o.currency)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && option && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-ink-900">Pick a time with {option.providerName}</h2>
            <SlotPicker providerServiceId={option.providerServiceId} tz={tz} selected={slot?.startsAt ?? null} onSelect={(s) => setSlot(s)} />
            <div className="flex justify-end">
              <Button disabled={!slot} onClick={() => setStep(3)}>Continue</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 3 && option && slot && service && (
        <Card className="max-w-xl">
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-ink-900">Review your booking</h2>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
              <dt className="text-ink-500">Service</dt><dd className="text-ink-900">{service.name}</dd>
              <dt className="text-ink-500">Provider</dt><dd className="text-ink-900">{option.providerName}</dd>
              <dt className="text-ink-500">When</dt><dd className="text-ink-900">{dateOnly(slot.startsAt, tz)}, {timeOnly(slot.startsAt, tz)}–{timeOnly(slot.endsAt, tz)}</dd>
              <dt className="text-ink-500">Price</dt>
              <dd className="flex items-center gap-2 text-ink-900">{money(option.priceCents, option.currency)} <Badge>{option.paymentMode === "ON_SITE" ? "Pay on site" : "Pay online after approval"}</Badge></dd>
            </dl>
            <Field label="Notes for the provider (optional)">
              {(p) => <Textarea {...p} rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
            {book.error && <ErrorNote message={errorMessage(book.error)} />}
            <Button onClick={() => book.mutate()} loading={book.isPending} className="w-full">Request booking</Button>
            <p className="text-center text-xs text-ink-500">The provider confirms your request. You won’t be charged until they ask for payment.</p>
          </CardBody>
        </Card>
      )}
    </>
  );
}
