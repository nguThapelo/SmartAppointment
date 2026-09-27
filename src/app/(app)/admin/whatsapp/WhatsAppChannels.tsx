"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Plus, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, fieldErrors, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/api";

interface Channel {
  id: string;
  name: string;
  displayNumber: string;
  phoneNumberId: string;
  provider: string;
  welcomeMessage: string;
  maxAdvanceDays: number;
  autoApprove: boolean;
  isActive: boolean;
  bookings: number;
  conversations: number;
}

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
}

type Draft = {
  providerId: string;
  phoneNumberId: string;
  displayNumber: string;
  name: string;
  welcomeMessage: string;
  maxAdvanceDays: number;
  autoApprove: boolean;
};

type Edit = Omit<Draft, "providerId" | "phoneNumberId"> & { id: string; isActive: boolean; phoneNumberId: string; provider: string };

const blankDraft = (providerId = ""): Draft => ({
  providerId, phoneNumberId: "", displayNumber: "", name: "", welcomeMessage: "Hi! 👋 Welcome. Reply with a number to get started.",
  maxAdvanceDays: 30, autoApprove: true,
});

export function WhatsAppChannels({ webhookUrl }: { webhookUrl: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Edit | null>(null);

  const channels = useQuery({ queryKey: ["wa-channels"], queryFn: () => api<{ data: Channel[] }>("/api/whatsapp/channels") });
  const providers = useQuery({
    queryKey: ["admin-users", "", "PROVIDER"],
    queryFn: () => api<{ data: Provider[] }>("/api/admin/users?pageSize=50&role=PROVIDER"),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["wa-channels"] });
  const create = useMutation({
    mutationFn: (d: Draft) => api("/api/whatsapp/channels", { body: d }),
    onSuccess: () => { toast("Channel added — send it a WhatsApp message to test"); setCreating(null); refresh(); },
  });
  const update = useMutation({
    mutationFn: ({ id, isActive, name, displayNumber, welcomeMessage, maxAdvanceDays, autoApprove }: Edit) =>
      api(`/api/whatsapp/channels/${id}`, { method: "PATCH", body: { isActive, name, displayNumber, welcomeMessage, maxAdvanceDays, autoApprove } }),
    onSuccess: () => { toast("Channel updated"); setEditing(null); refresh(); },
  });
  const toggle = useMutation({
    mutationFn: (c: Channel) => api(`/api/whatsapp/channels/${c.id}`, { method: "PATCH", body: { isActive: !c.isActive } }),
    onSuccess: (_, c) => { toast(c.isActive ? "Channel turned off" : "Channel turned on"); refresh(); },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const createErrors = create.error instanceof ApiError && create.error.status === 422 ? fieldErrors(create.error.details) : {};

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast("Webhook URL copied");
    } catch {
      toast("Couldn’t copy — select the URL and copy it manually", "warning");
    }
  }

  return (
    <>
      <PageHeader
        title="WhatsApp channels"
        description="Each channel is a WhatsApp number that books appointments for one provider."
        action={
          <Button icon={<Plus className="size-4" />} onClick={() => { create.reset(); setCreating(blankDraft(providers.data?.data[0]?.id)); }}>
            Add channel
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Meta webhook" description="Paste this into your Meta app under WhatsApp → Configuration → Webhook." icon={<Smartphone className="size-4" />} />
        <CardBody className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-50 px-3 py-2 text-[13px] text-ink-800 ring-1 ring-inset ring-ink-100">{webhookUrl}</code>
          <IconButton label="Copy webhook URL" icon={<Copy className="size-4" />} onClick={copyWebhook} />
        </CardBody>
      </Card>

      <Card>
        {channels.isPending ? <Loading /> : channels.error ? <div className="p-5"><ErrorNote message={errorMessage(channels.error)} /></div> : !channels.data.data.length ? (
          <EmptyState title="No channels yet" icon={<Smartphone className="size-5" />}>Add your Meta phone number to start taking bookings on WhatsApp.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Activity</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {channels.data.data.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{c.name}</p>
                      <p className="text-ink-500">{c.displayNumber} · ID {c.phoneNumberId}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-700">{c.provider}</td>
                    <td className="space-x-1 px-5 py-3">
                      {c.isActive ? <Badge tone="success" dot>On</Badge> : <Badge>Off</Badge>}
                      {c.autoApprove && <Badge tone="brand">Auto-confirm</Badge>}
                    </td>
                    <td className="px-5 py-3 text-ink-500">{c.conversations} chats · {c.bookings} bookings</td>
                    <td className="space-x-2 whitespace-nowrap px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" loading={toggle.isPending && toggle.variables?.id === c.id} onClick={() => toggle.mutate(c)}>
                        {c.isActive ? "Turn off" : "Turn on"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { update.reset(); setEditing({ ...c }); }}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={!!creating}
        onClose={() => setCreating(null)}
        title="Add WhatsApp channel"
        footer={<><Button variant="secondary" onClick={() => setCreating(null)}>Cancel</Button><Button loading={create.isPending} onClick={() => creating && create.mutate(creating)}>Add channel</Button></>}
      >
        {creating && (
          <div className="space-y-3">
            <Field label="Provider" error={createErrors.providerId}>
              {(p) => (
                <Select {...p} value={creating.providerId} onChange={(e) => setCreating({ ...creating, providerId: e.target.value })}>
                  {!providers.data?.data.length && <option value="">No providers yet</option>}
                  {providers.data?.data.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Phone number ID" hint="Meta → WhatsApp → API Setup → Phone number ID (digits only)." error={createErrors.phoneNumberId}>
              {(p) => <Input {...p} inputMode="numeric" value={creating.phoneNumberId} onChange={(e) => setCreating({ ...creating, phoneNumberId: e.target.value.trim() })} />}
            </Field>
            <ChannelFields value={creating} onChange={(v) => setCreating({ ...creating, ...v })} errors={createErrors} />
            {create.error && create.error instanceof ApiError && create.error.status !== 422 && <ErrorNote message={errorMessage(create.error)} />}
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? editing.name : ""}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={update.isPending} onClick={() => editing && update.mutate(editing)}>Save</Button></>}
      >
        {editing && (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">{editing.provider} · Phone number ID {editing.phoneNumberId}</p>
            <ChannelFields value={editing} onChange={(v) => setEditing({ ...editing, ...v })} errors={{}} />
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="size-4 rounded border-ink-300" /> Channel on
            </label>
            {update.error && <ErrorNote message={errorMessage(update.error)} />}
          </div>
        )}
      </Dialog>
    </>
  );
}

type Shared = Pick<Draft, "name" | "displayNumber" | "welcomeMessage" | "maxAdvanceDays" | "autoApprove">;

function ChannelFields({ value, onChange, errors }: { value: Shared; onChange: (v: Partial<Shared>) => void; errors: Record<string, string> }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Channel name" error={errors.name}>
          {(p) => <Input {...p} placeholder="Thandi’s Salon" value={value.name} onChange={(e) => onChange({ name: e.target.value })} />}
        </Field>
        <Field label="Display number" error={errors.displayNumber}>
          {(p) => <Input {...p} placeholder="+1 555 123 4567" value={value.displayNumber} onChange={(e) => onChange({ displayNumber: e.target.value })} />}
        </Field>
      </div>
      <Field label="Welcome message" error={errors.welcomeMessage}>
        {(p) => <Textarea {...p} rows={2} value={value.welcomeMessage} onChange={(e) => onChange({ welcomeMessage: e.target.value })} />}
      </Field>
      <Field label="Book up to (days ahead)" error={errors.maxAdvanceDays}>
        {(p) => (
          <Input {...p} type="number" min={1} max={60} value={value.maxAdvanceDays} onChange={(e) => onChange({ maxAdvanceDays: Number(e.target.value) })} />
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={value.autoApprove} onChange={(e) => onChange({ autoApprove: e.target.checked })} className="size-4 rounded border-ink-300" />
        Confirm WhatsApp bookings automatically
      </label>
    </>
  );
}
