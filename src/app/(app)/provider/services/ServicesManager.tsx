"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";

interface OwnService {
  id: string;
  subServiceId: string;
  serviceName: string;
  category: string;
  pricingType: "FIXED" | "HOURLY";
  rateCents: number;
  priceCents: number;
  currency: string;
  durationMin: number;
  paymentMode: "ONLINE" | "ON_SITE";
  isActive: boolean;
}
interface Category {
  name: string;
  subServices: { id: string; name: string }[];
}
interface FormState {
  subServiceId: string;
  pricingType: "FIXED" | "HOURLY";
  rand: string;
  durationMin: string;
  paymentMode: "ONLINE" | "ON_SITE";
  isActive: boolean;
}

const blank: FormState = { subServiceId: "", pricingType: "FIXED", rand: "", durationMin: "60", paymentMode: "ONLINE", isActive: true };

export function ServicesManager() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<FormState | null>(null);
  const services = useQuery({ queryKey: ["own-services"], queryFn: () => api<{ data: OwnService[] }>("/api/provider/services") });
  const catalog = useQuery({ queryKey: ["categories"], queryFn: () => api<{ data: Category[] }>("/api/catalog/categories") });

  const save = useMutation({
    mutationFn: (f: FormState) =>
      api("/api/provider/services", {
        method: "PUT",
        body: {
          subServiceId: f.subServiceId,
          pricingType: f.pricingType,
          rateCents: Math.round(Number(f.rand) * 100),
          durationMin: Number(f.durationMin),
          paymentMode: f.paymentMode,
          isActive: f.isActive,
        },
      }),
    onSuccess: () => {
      toast("Saved");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["own-services"] });
    },
  });

  const valid = editing && editing.subServiceId && Number(editing.rand) >= 0 && editing.rand !== "" && Number(editing.durationMin) >= 5;

  return (
    <>
      <PageHeader
        title="Services & prices"
        description="What clients can book with you, for how long, and how they pay."
        action={<Button icon={<Plus className="size-4" />} onClick={() => { save.reset(); setEditing(blank); }}>Add service</Button>}
      />
      <Card>
        {services.isPending ? (
          <Loading />
        ) : services.error ? (
          <div className="p-5"><ErrorNote message={errorMessage(services.error)} /></div>
        ) : !services.data.data.length ? (
          <EmptyState title="You don't offer any services yet" action={<Button onClick={() => setEditing(blank)}>Add your first service</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr><th className="px-5 py-3 font-medium">Service</th><th className="px-5 py-3 font-medium">Price</th><th className="px-5 py-3 font-medium">Duration</th><th className="px-5 py-3 font-medium">Payment</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {services.data.data.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3"><p className="font-medium text-ink-900">{s.serviceName}</p><p className="text-xs text-ink-500">{s.category}</p></td>
                    <td className="px-5 py-3">{money(s.rateCents, s.currency)}{s.pricingType === "HOURLY" && <span className="text-ink-500"> /hour</span>}</td>
                    <td className="px-5 py-3">{s.durationMin} min</td>
                    <td className="px-5 py-3">{s.paymentMode === "ONLINE" ? "Online" : "On site"}</td>
                    <td className="px-5 py-3"><Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Bookable" : "Hidden"}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <IconButton
                        label={`Edit ${s.serviceName}`}
                        icon={<Pencil className="size-4" />}
                        onClick={() => {
                          save.reset();
                          setEditing({ subServiceId: s.subServiceId, pricingType: s.pricingType, rand: (s.rateCents / 100).toFixed(2), durationMin: String(s.durationMin), paymentMode: s.paymentMode, isActive: s.isActive });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Service & price"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={save.isPending} disabled={!valid} onClick={() => editing && save.mutate(editing)}>Save</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Service">
              {(p) => (
                <Select {...p} value={editing.subServiceId} onChange={(e) => setEditing({ ...editing, subServiceId: e.target.value })}>
                  <option value="">Choose a service…</option>
                  {catalog.data?.data.map((c) => (
                    <optgroup key={c.name} label={c.name}>
                      {c.subServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pricing">
                {(p) => (
                  <Select {...p} value={editing.pricingType} onChange={(e) => setEditing({ ...editing, pricingType: e.target.value as FormState["pricingType"] })}>
                    <option value="FIXED">Fixed price</option>
                    <option value="HOURLY">Per hour</option>
                  </Select>
                )}
              </Field>
              <Field label="Price (R)">
                {(p) => <Input {...p} type="number" min="0" step="0.01" inputMode="decimal" value={editing.rand} onChange={(e) => setEditing({ ...editing, rand: e.target.value })} />}
              </Field>
              <Field label="Duration (min)">
                {(p) => <Input {...p} type="number" min="5" max="720" step="5" value={editing.durationMin} onChange={(e) => setEditing({ ...editing, durationMin: e.target.value })} />}
              </Field>
              <Field label="Payment">
                {(p) => (
                  <Select {...p} value={editing.paymentMode} onChange={(e) => setEditing({ ...editing, paymentMode: e.target.value as FormState["paymentMode"] })}>
                    <option value="ONLINE">Online (Stripe)</option>
                    <option value="ON_SITE">On site</option>
                  </Select>
                )}
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="size-4 rounded border-ink-300" />
              Clients can book this service
            </label>
            {save.error && <ErrorNote message={errorMessage(save.error)} />}
          </div>
        )}
      </Dialog>
    </>
  );
}
