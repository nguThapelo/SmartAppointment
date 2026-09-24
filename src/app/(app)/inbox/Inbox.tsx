"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNote, Loading, Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { cx, relative } from "@/lib/format";

interface Conversation {
  id: string;
  channel: string;
  customerName: string | null;
  customerPhone: string;
  lastMessage: string | null;
  lastInboundAt: string | null;
  canReply: boolean;
}
interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  createdAt: string;
}
interface Channel {
  id: string;
  name: string;
  displayNumber: string;
  phoneNumberId: string;
  provider: string;
  welcomeMessage: string;
  autoApprove: boolean;
  isActive: boolean;
  bookings: number;
  conversations: number;
}

export function Inbox({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<"conversations" | "channels">("conversations");
  return (
    <>
      <PageHeader title="WhatsApp" description="Customers book, check and change appointments by messaging your number." />
      {isAdmin && (
        <div className="mb-4 inline-flex rounded-lg border border-ink-200 bg-white p-0.5" role="tablist">
          {(["conversations", "channels"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-md px-3 py-1.5 text-sm font-medium capitalize", tab === t ? "bg-ink-900 text-white" : "text-ink-600")}>
              {t}
            </button>
          ))}
        </div>
      )}
      {tab === "conversations" ? <Conversations /> : <Channels />}
    </>
  );
}

function Conversations() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const list = useQuery({ queryKey: ["wa-conversations"], queryFn: () => api<{ data: Conversation[] }>("/api/whatsapp/conversations"), refetchInterval: 10_000 });
  const current = list.data?.data.find((c) => c.id === selected) ?? null;
  const messages = useQuery({
    queryKey: ["wa-messages", selected],
    queryFn: () => api<{ data: Message[] }>(`/api/whatsapp/conversations/${selected}/messages`),
    enabled: !!selected,
    refetchInterval: 5000,
  });
  const send = useMutation({
    mutationFn: () => api(`/api/whatsapp/conversations/${selected}/reply`, { body: { body: reply.trim() } }),
    onSuccess: () => {
      setReply("");
      void qc.invalidateQueries({ queryKey: ["wa-messages", selected] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (reply.trim()) send.mutate();
  }

  if (list.isPending) return <Loading />;
  if (list.error) return <ErrorNote message={errorMessage(list.error)} />;
  if (!list.data.data.length) {
    return <Card><EmptyState icon={<MessageCircle className="size-10" />} title="No WhatsApp conversations yet">When customers message your WhatsApp number, their chats appear here.</EmptyState></Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="max-h-[70vh] overflow-y-auto">
        <ul className="divide-y divide-ink-100">
          {list.data.data.map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)} aria-current={selected === c.id || undefined} className={cx("w-full px-4 py-3 text-left hover:bg-ink-50", selected === c.id && "bg-brand-50")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-ink-900">{c.customerName ?? c.customerPhone}</p>
                  {c.lastInboundAt && <span className="shrink-0 text-xs text-ink-400">{relative(c.lastInboundAt)}</span>}
                </div>
                <p className="truncate text-sm text-ink-500">{c.lastMessage ?? "—"}</p>
                <p className="text-xs text-ink-400">{c.channel}</p>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex min-h-[50vh] flex-col lg:col-span-2">
        {!current ? (
          <EmptyState title="Select a conversation" />
        ) : (
          <>
            <CardHeader title={current.customerName ?? current.customerPhone} description={`${current.customerPhone} · ${current.channel}`} />
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] px-4 py-4" aria-live="polite">
              {messages.data?.data.map((m) => (
                <div key={m.id} className={cx("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                  <p className={cx("max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm shadow-sm", m.direction === "OUTBOUND" ? "bg-[#d9fdd3]" : "bg-white")}>
                    {m.body}
                    <span className="mt-0.5 block text-right text-[10px] text-ink-400">{relative(m.createdAt)}</span>
                  </p>
                </div>
              ))}
            </div>
            {current.canReply ? (
              <form onSubmit={onSubmit} className="flex gap-2 border-t border-ink-100 p-3">
                <label htmlFor="wa-reply" className="sr-only">Reply</label>
                <input id="wa-reply" value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" className="h-10 flex-1 rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-500" />
                <Button type="submit" loading={send.isPending} disabled={!reply.trim()} icon={<Send className="size-4" />} aria-label="Send" />
              </form>
            ) : (
              <div className="border-t border-ink-100 p-3"><Notice>Replies are only possible within 24 hours of the customer’s last message (WhatsApp’s free service window).</Notice></div>
            )}
            {send.error && <div className="px-3 pb-3"><ErrorNote message={errorMessage(send.error)} /></div>}
          </>
        )}
      </Card>
    </div>
  );
}

function Channels() {
  const qc = useQueryClient();
  const toast = useToast();
  const channels = useQuery({ queryKey: ["wa-channels"], queryFn: () => api<{ data: Channel[] }>("/api/whatsapp/channels") });
  const providers = useQuery({ queryKey: ["providers-list"], queryFn: () => api<{ data: { id: string; firstName: string; lastName: string }[] }>("/api/admin/users?role=PROVIDER&pageSize=100") });
  const [form, setForm] = useState<null | { providerId: string; phoneNumberId: string; displayNumber: string; name: string; welcomeMessage: string }>(null);

  const create = useMutation({
    mutationFn: () => api("/api/whatsapp/channels", { body: { ...form, maxAdvanceDays: 30, autoApprove: true } }),
    onSuccess: () => { toast("Channel added"); setForm(null); void qc.invalidateQueries({ queryKey: ["wa-channels"] }); },
  });
  const toggle = useMutation({
    mutationFn: (c: Channel) => api(`/api/whatsapp/channels/${c.id}`, { method: "PATCH", body: { isActive: !c.isActive } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["wa-channels"] }),
  });

  return (
    <>
      <Card>
        <CardHeader
          title="Channels"
          description="Each WhatsApp number books into one provider's services. Meta credentials live in environment variables, never here."
          action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => { create.reset(); setForm({ providerId: "", phoneNumberId: "", displayNumber: "", name: "", welcomeMessage: "Hi! 👋 Welcome." }); }}>Add channel</Button>}
        />
        {channels.isPending ? <Loading /> : channels.error ? <CardBody><ErrorNote message={errorMessage(channels.error)} /></CardBody> : !channels.data.data.length ? <EmptyState title="No channels" /> : (
          <ul className="divide-y divide-ink-100">
            {channels.data.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-ink-900">{c.name} <span className="font-normal text-ink-500">· {c.displayNumber}</span></p>
                  <p className="text-sm text-ink-500">{c.provider} · {c.bookings} bookings · {c.conversations} chats · auto-approve {c.autoApprove ? "on" : "off"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? "Live" : "Off"}</Badge>
                  <Button size="sm" variant="secondary" loading={toggle.isPending && toggle.variables?.id === c.id} onClick={() => toggle.mutate(c)}>{c.isActive ? "Turn off" : "Turn on"}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Dialog open={!!form} onClose={() => setForm(null)} title="Add WhatsApp channel" footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Add</Button></>}>
        {form && (
          <div className="space-y-3">
            <Field label="Provider">
              {(p) => (
                <Select {...p} value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                  <option value="">Choose…</option>
                  {providers.data?.data.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Name">{(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meta phone number ID" hint="From WhatsApp → API setup">{(p) => <Input {...p} inputMode="numeric" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />}</Field>
              <Field label="Display number">{(p) => <Input {...p} value={form.displayNumber} onChange={(e) => setForm({ ...form, displayNumber: e.target.value })} />}</Field>
            </div>
            <Field label="Welcome message">{(p) => <Textarea {...p} rows={2} maxLength={500} value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />}</Field>
            {create.error && <ErrorNote message={errorMessage(create.error)} />}
          </div>
        )}
      </Dialog>
    </>
  );
}
