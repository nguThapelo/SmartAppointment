"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { CreditCard, FileText, Paperclip, Send, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNote, Notice, Skeleton } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { cx, dateTime, money, relative, STATUS_LABEL } from "@/lib/format";
import { SlotPicker } from "./SlotPicker";
import type { BookingDTO, PaymentView } from "./types";

// ── Payment ─────────────────────────────────────────────────────────────────

const PAYMENT_LABEL: Record<string, string> = {
  CREATED: "Starting…", PENDING: "Waiting for payment", SUCCEEDED: "Paid", FAILED: "Failed", EXPIRED: "Link expired", REFUNDED: "Refunded",
};

export function PaymentPanel({ booking, isCustomer }: { booking: BookingDTO; isCustomer: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const payment = useQuery({
    queryKey: ["payment", booking.reference],
    queryFn: () => api<{ payment: PaymentView | null }>(`/api/bookings/${booking.reference}/payment`),
    // While a checkout is open, keep checking — status only changes via Stripe's webhook.
    refetchInterval: (q) => (q.state.data?.payment?.status === "PENDING" ? 5000 : false),
  });
  const request = useMutation({
    mutationFn: () => api(`/api/bookings/${booking.reference}/payment`, { method: "POST", body: {}, idempotencyKey: key }),
    onSuccess: () => {
      toast("Payment link sent to the client");
      void qc.invalidateQueries();
    },
  });

  if (booking.paymentMode === "ON_SITE") {
    return (
      <Card>
        <CardHeader title="Payment" />
        <CardBody><p className="text-sm text-ink-600">Paid in person at the appointment.</p></CardBody>
      </Card>
    );
  }
  const p = payment.data?.payment;
  const canRequest = booking.availableActions.includes("requestPayment");

  return (
    <Card>
      <CardHeader title="Payment" description={money(booking.priceCents, booking.currency)} />
      <CardBody className="space-y-3">
        {payment.isPending ? (
          <Skeleton className="h-10" />
        ) : !p ? (
          <p className="text-sm text-ink-500">{canRequest ? "No payment requested yet." : "Payment is requested after the booking is confirmed."}</p>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-600">Attempt {p.attempt}</span>
            <Badge tone={p.status === "SUCCEEDED" ? "success" : p.status === "PENDING" ? "warning" : p.status === "FAILED" || p.status === "EXPIRED" ? "danger" : "neutral"}>
              {PAYMENT_LABEL[p.status] ?? p.status}
            </Badge>
          </div>
        )}
        {isCustomer && p?.checkoutUrl && (
          <a
            href={p.checkoutUrl}
            rel="noopener noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
          >
            <CreditCard className="size-4" /> Pay {money(p.amountCents, p.currency)} securely
          </a>
        )}
        {isCustomer && p?.status === "PENDING" && (
          <p className="text-xs text-ink-500">Stripe test mode — use card 4242 4242 4242 4242, any future date and CVC.</p>
        )}
        {canRequest && (
          <Button onClick={() => request.mutate()} loading={request.isPending} className="w-full" icon={<CreditCard className="size-4" />}>
            {p ? "Send a new payment link" : "Request payment"}
          </Button>
        )}
        {request.error && <ErrorNote message={errorMessage(request.error)} />}
      </CardBody>
    </Card>
  );
}

// ── Reschedule ──────────────────────────────────────────────────────────────

export function RescheduleButton({ booking, tz, isCustomer }: { booking: BookingDTO; tz: string; isCustomer: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: () => api<BookingDTO>(`/api/bookings/${booking.reference}/reschedule`, { body: { startsAt: slot } }),
    onSuccess: (b) => {
      toast(b.status === "PENDING" && isCustomer ? "Moved — waiting for the provider to approve" : "Booking moved");
      setOpen(false);
      void qc.invalidateQueries();
    },
  });
  const allowed = isCustomer ? ["PENDING", "APPROVED"] : ["PENDING", "APPROVED", "PAID"];
  if (!allowed.includes(booking.status) || new Date(booking.startsAt) < new Date()) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => { setSlot(null); move.reset(); setOpen(true); }}>Reschedule</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Pick a new time"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Back</Button>
            <Button loading={move.isPending} disabled={!slot} onClick={() => move.mutate()}>Move booking</Button>
          </>
        }
      >
        <div className="space-y-3">
          {isCustomer && booking.status === "APPROVED" && <Notice tone="warning">The provider will need to approve the new time.</Notice>}
          <SlotPicker providerServiceId={booking.providerServiceId} tz={tz} selected={slot} onSelect={(s) => setSlot(s.startsAt)} />
          {move.error && <ErrorNote message={errorMessage(move.error)} />}
        </div>
      </Dialog>
    </>
  );
}

// ── Chat ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  body: string;
  sender: { name: string; role: string };
  mine: boolean;
  createdAt: string;
}

export function ChatPanel({ booking, canPost }: { booking: BookingDTO; canPost: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const messages = useQuery({
    queryKey: ["chat", booking.reference],
    queryFn: () => api<{ data: ChatMessage[] }>(`/api/bookings/${booking.reference}/messages`),
    refetchInterval: 5000, // polling: Amplify SSR has no websockets
  });
  const post = useMutation({
    mutationFn: (body: string) => api(`/api/bookings/${booking.reference}/messages`, { body: { body } }),
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["chat", booking.reference] });
    },
  });
  const closed = ["DECLINED", "CANCELLED", "CLOSED", "NO_SHOW"].includes(booking.status);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) post.mutate(text.trim());
  }

  if (booking.channel === "WHATSAPP") {
    return (
      <Card>
        <CardHeader title="Messages" />
        <CardBody><p className="text-sm text-ink-500">This customer booked on WhatsApp — reply from the WhatsApp inbox.</p></CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Messages" description="Between the client and the provider." />
      <div className="max-h-80 space-y-2 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.isPending ? (
          <Skeleton className="h-16" />
        ) : !messages.data?.data.length ? (
          <p className="text-center text-sm text-ink-400">No messages yet.</p>
        ) : (
          messages.data.data.map((m) => (
            <div key={m.id} className={cx("flex flex-col", m.mine ? "items-end" : "items-start")}>
              <p className={cx("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-sm", m.mine ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-800")}>
                {m.body}
              </p>
              <span className="mt-0.5 text-[11px] text-ink-400">{m.mine ? "You" : m.sender.name} · {relative(m.createdAt)}</span>
            </div>
          ))
        )}
      </div>
      {canPost && !closed && (
        <form onSubmit={onSubmit} className="flex gap-2 border-t border-ink-100 p-3">
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <input
            id="chat-input"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            className="h-10 flex-1 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-500"
          />
          <Button type="submit" loading={post.isPending} disabled={!text.trim()} aria-label="Send" icon={<Send className="size-4" />} />
        </form>
      )}
      {post.error && <div className="px-3 pb-3"><ErrorNote message={errorMessage(post.error)} /></div>}
    </Card>
  );
}

// ── Files ───────────────────────────────────────────────────────────────────

interface FileView {
  id: string;
  fileName: string;
  size: number;
  uploadedBy: { name: string; role: string };
  uploadedAt: string;
}

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

export function FilesPanel({ booking }: { booking: BookingDTO }) {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const files = useQuery({
    queryKey: ["files", booking.reference],
    queryFn: () => api<{ data: FileView[] }>(`/api/bookings/${booking.reference}/files`),
  });

  async function upload(file: File) {
    setError(null);
    if (!ALLOWED.includes(file.type)) return setError("Only PDF, PNG or JPEG files.");
    if (file.size > 5 * 1024 * 1024) return setError("Files must be 5 MB or smaller.");
    setUploading(true);
    try {
      // 1) ask for a presigned URL, 2) PUT straight to S3, 3) confirm.
      const r = await api<{ fileId: string; uploadUrl: string }>(`/api/bookings/${booking.reference}/files`, {
        body: { fileName: file.name, contentType: file.type, size: file.size },
      });
      const put = await fetch(r.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("upload failed");
      await api(`/api/files/${r.fileId}/confirm`, { method: "POST" });
      toast("File uploaded");
      void qc.invalidateQueries({ queryKey: ["files", booking.reference] });
    } catch (err) {
      setError(err instanceof Error && err.message === "upload failed" ? "Upload failed. Please try again." : errorMessage(err));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function download(id: string) {
    try {
      const { url } = await api<{ url: string }>(`/api/files/${id}/download`);
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader
        title="Attachments"
        action={
          <>
            <input ref={input} type="file" accept={ALLOWED.join(",")} className="sr-only" id="file-upload" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button size="sm" variant="secondary" loading={uploading} onClick={() => input.current?.click()} icon={<Upload className="size-4" />}>
              Upload
            </Button>
          </>
        }
      />
      <CardBody className="space-y-2">
        {error && <ErrorNote message={error} />}
        {files.isPending ? (
          <Skeleton className="h-8" />
        ) : !files.data?.data.length ? (
          <p className="flex items-center gap-2 text-sm text-ink-400"><Paperclip className="size-4" /> No files yet.</p>
        ) : (
          <ul className="space-y-1">
            {files.data.data.map((f) => (
              <li key={f.id}>
                <button onClick={() => download(f.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50">
                  <FileText className="size-4 text-ink-400" />
                  <span className="flex-1 truncate text-ink-800">{f.fileName}</span>
                  <span className="text-xs text-ink-400">{(f.size / 1024).toFixed(0)} KB · {f.uploadedBy.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  text: string;
  answerType: "RATING_1_5" | "TEXT" | "YES_NO" | "SINGLE_CHOICE";
  options: string[] | null;
  isRequired: boolean;
}

export function FeedbackPanel({ booking }: { booking: BookingDTO }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [key] = useState(newIdempotencyKey);
  const fb = useQuery({
    queryKey: ["feedback", booking.reference],
    queryFn: () =>
      api<{ canSubmit: boolean; questions: Question[]; response: { submittedAt: string; answers: { questionId: string; value: string }[] } | null }>(
        `/api/bookings/${booking.reference}/feedback`,
      ),
  });
  const submit = useMutation({
    mutationFn: () =>
      api(`/api/bookings/${booking.reference}/feedback`, {
        body: { answers: Object.entries(answers).filter(([, v]) => v.trim()).map(([questionId, value]) => ({ questionId, value })) },
        idempotencyKey: key,
      }),
    onSuccess: () => {
      toast("Thanks for your feedback!");
      void qc.invalidateQueries();
    },
  });

  if (fb.isPending || !fb.data) return null;
  const { canSubmit, questions, response } = fb.data;
  if (!canSubmit && !response) return null;
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));
  const missing = questions.some((q) => q.isRequired && !answers[q.id]?.trim());

  return (
    <Card>
      <CardHeader title="Feedback" description={response ? `Submitted ${relative(response.submittedAt)}` : "How did it go?"} />
      <CardBody className="space-y-4">
        {response ? (
          <ul className="space-y-2 text-sm">
            {response.answers.map((a) => (
              <li key={a.questionId}>
                <span className="text-ink-500">{questions.find((q) => q.id === a.questionId)?.text}</span>
                <p className="font-medium text-ink-800">{a.value}</p>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {questions.map((q) => (
              <div key={q.id}>
                {q.answerType === "RATING_1_5" ? (
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-ink-700">{q.text}{q.isRequired && " *"}</legend>
                    <div className="flex gap-1.5">
                      {["1", "2", "3", "4", "5"].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={answers[q.id] === n}
                          onClick={() => set(q.id, n)}
                          className={cx("size-10 rounded-lg border text-sm font-semibold", answers[q.id] === n ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-600 hover:border-brand-300")}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : q.answerType === "TEXT" ? (
                  <Field label={`${q.text}${q.isRequired ? " *" : ""}`}>
                    {(p) => <Textarea {...p} rows={3} maxLength={2000} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} />}
                  </Field>
                ) : (
                  <Field label={`${q.text}${q.isRequired ? " *" : ""}`}>
                    {(p) => (
                      <Select {...p} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)}>
                        <option value="">Choose…</option>
                        {(q.answerType === "YES_NO" ? ["yes", "no"] : (q.options ?? [])).map((o) => (
                          <option key={o} value={o}>{o[0]!.toUpperCase() + o.slice(1)}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
            ))}
            {submit.error && <ErrorNote message={errorMessage(submit.error)} />}
            <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={missing}>Submit feedback</Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ── History ─────────────────────────────────────────────────────────────────

export function HistoryPanel({ booking, tz }: { booking: BookingDTO; tz: string }) {
  const history = useQuery({
    queryKey: ["history", booking.reference, booking.status],
    queryFn: () => api<{ data: { from: string | null; to: string; action: string; actorType: string; reason: string | null; at: string }[] }>(`/api/bookings/${booking.reference}/history`),
  });
  return (
    <Card>
      <CardHeader title="History" />
      <CardBody>
        {history.isPending ? (
          <Skeleton className="h-16" />
        ) : !history.data?.data.length ? (
          <EmptyState title="No history" />
        ) : (
          <ol className="relative space-y-3 border-l border-ink-200 pl-4">
            {history.data.data.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-brand-500" aria-hidden />
                <p className="font-medium text-ink-800">
                  {h.action === "create" ? "Requested" : h.action === "reschedule" ? "Rescheduled" : STATUS_LABEL[h.to] ?? h.to}
                  <span className="font-normal text-ink-400"> · {h.actorType === "AGENT" ? "via assistant" : h.actorType === "WEBHOOK" ? "by Stripe" : h.actorType === "SYSTEM" ? "automatically" : h.actorType === "WHATSAPP" ? "via WhatsApp" : "by user"}</span>
                </p>
                <p className="text-xs text-ink-400">{dateTime(h.at, tz)}</p>
                {h.reason && <p className="mt-0.5 text-ink-600">“{h.reason}”</p>}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
