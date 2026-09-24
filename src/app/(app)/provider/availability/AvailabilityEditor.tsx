"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { isoDate } from "@/lib/format";

interface Rule {
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
}
interface Override {
  id: string;
  date: string;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reason: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // week starts Monday

export function AvailabilityEditor() {
  const qc = useQueryClient();
  const toast = useToast();
  const data = useQuery({ queryKey: ["availability"], queryFn: () => api<{ rules: Rule[]; overrides: Override[] }>("/api/provider/availability") });
  // Unsaved edits live in a draft over the server copy (no state syncing in effects).
  const [draft, setDraft] = useState<Rule[] | null>(null);
  const [override, setOverride] = useState({ date: isoDate(1), isClosed: true, opensAt: "09:00", closesAt: "13:00", reason: "" });

  const rules: Rule[] = draft ?? (data.data
    ? Array.from({ length: 7 }, (_, d) => data.data.rules.find((r) => r.dayOfWeek === d) ?? { dayOfWeek: d, isOpen: false, opensAt: "08:00", closesAt: "17:00" })
    : []);

  const saveRules = useMutation({
    mutationFn: () => api("/api/provider/availability", { method: "PUT", body: { rules } }),
    onSuccess: () => {
      toast("Weekly hours saved");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
  const addOverride = useMutation({
    mutationFn: () =>
      api("/api/provider/availability/overrides", {
        body: override.isClosed
          ? { date: override.date, isClosed: true, ...(override.reason ? { reason: override.reason } : {}) }
          : { date: override.date, isClosed: false, opensAt: override.opensAt, closesAt: override.closesAt, ...(override.reason ? { reason: override.reason } : {}) },
      }),
    onSuccess: () => {
      toast("Exception added");
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
  const removeOverride = useMutation({
    mutationFn: (id: string) => api(`/api/provider/availability/overrides/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["availability"] }),
  });

  if (data.error) return <ErrorNote message={errorMessage(data.error)} />;
  if (data.isPending || !rules.length) return <Loading />;
  const update = (d: number, patch: Partial<Rule>) => setDraft(rules.map((r) => (r.dayOfWeek === d ? { ...r, ...patch } : r)));
  const invalid = rules.some((r) => r.isOpen && r.opensAt >= r.closesAt);

  return (
    <>
      <PageHeader title="Availability" description="Clients can only book inside these hours. Times are in your timezone." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Weekly hours" action={<Button loading={saveRules.isPending} disabled={invalid} onClick={() => saveRules.mutate()}>Save</Button>} />
          <CardBody className="space-y-2">
            {ORDER.map((d) => {
              const r = rules[d]!;
              return (
                <div key={d} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                  <label className="flex w-36 items-center gap-2 text-sm font-medium text-ink-800">
                    <input type="checkbox" checked={r.isOpen} onChange={(e) => update(d, { isOpen: e.target.checked })} className="size-4 rounded border-ink-300" />
                    {DAYS[d]}
                  </label>
                  {r.isOpen ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Input type="time" aria-label={`${DAYS[d]} opens`} value={r.opensAt} onChange={(e) => update(d, { opensAt: e.target.value })} className="w-28" />
                      <span className="text-ink-400">to</span>
                      <Input type="time" aria-label={`${DAYS[d]} closes`} value={r.closesAt} onChange={(e) => update(d, { closesAt: e.target.value })} className="w-28" />
                      {r.opensAt >= r.closesAt && <span className="text-xs text-red-700">Closing must be after opening</span>}
                    </div>
                  ) : (
                    <span className="text-sm text-ink-400">Closed</span>
                  )}
                </div>
              );
            })}
            {saveRules.error && <ErrorNote message={errorMessage(saveRules.error)} />}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Exceptions" description="Holidays, leave or special hours." />
          <CardBody className="space-y-4">
            <div className="space-y-3 rounded-lg bg-ink-50 p-3">
              <Field label="Date">{(p) => <Input {...p} type="date" min={isoDate(0)} value={override.date} onChange={(e) => setOverride({ ...override, date: e.target.value })} />}</Field>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={override.isClosed} onChange={(e) => setOverride({ ...override, isClosed: e.target.checked })} className="size-4 rounded border-ink-300" />
                Closed all day
              </label>
              {!override.isClosed && (
                <div className="flex items-center gap-2">
                  <Input type="time" aria-label="Opens" value={override.opensAt} onChange={(e) => setOverride({ ...override, opensAt: e.target.value })} />
                  <span className="text-ink-400">to</span>
                  <Input type="time" aria-label="Closes" value={override.closesAt} onChange={(e) => setOverride({ ...override, closesAt: e.target.value })} />
                </div>
              )}
              <Field label="Reason (optional)">{(p) => <Input {...p} maxLength={200} value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} />}</Field>
              <Button size="sm" loading={addOverride.isPending} onClick={() => addOverride.mutate()}>Add exception</Button>
              {addOverride.error && <ErrorNote message={errorMessage(addOverride.error)} />}
            </div>
            {data.data.overrides.length === 0 ? (
              <p className="text-sm text-ink-400">No upcoming exceptions.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.data.overrides.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-ink-800">{new Date(`${o.date}T12:00:00Z`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</p>
                      <p className="text-ink-500">{o.isClosed ? "Closed" : `${o.opensAt}–${o.closesAt}`}{o.reason ? ` · ${o.reason}` : ""}</p>
                    </div>
                    <IconButton label="Remove exception" tone="danger" icon={<Trash2 className="size-4" />} loading={removeOverride.isPending && removeOverride.variables === o.id} onClick={() => removeOverride.mutate(o.id)} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
