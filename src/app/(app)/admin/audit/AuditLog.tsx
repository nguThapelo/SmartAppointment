"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";

interface Event {
  id: string;
  at: string;
  action: string;
  outcome: "success" | "denied" | "failed";
  actorType: string;
  actorId: string | null;
  actorRole: string | null;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  detail: Record<string, unknown>;
}

export function AuditLog({ tz }: { tz: string }) {
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const q = useQuery({
    queryKey: ["audit", action, outcome],
    queryFn: () => api<{ data: Event[] }>(`/api/admin/audit?limit=100${action ? `&action=${encodeURIComponent(action)}` : ""}${outcome ? `&outcome=${outcome}` : ""}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, role change, booking transition, payment and assistant action. Details never contain free text or secrets." />
      <div className="mb-4 flex flex-wrap gap-3">
        <label htmlFor="audit-action" className="sr-only">Action prefix</label>
        <Input id="audit-action" placeholder="Action, e.g. booking. or user.role_change" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" />
        <label htmlFor="audit-outcome" className="sr-only">Outcome</label>
        <Select id="audit-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-40">
          <option value="">Any outcome</option><option value="success">Success</option><option value="denied">Denied</option><option value="failed">Failed</option>
        </Select>
      </div>
      <Card>
        {q.isPending ? <Loading /> : q.error ? <div className="p-5"><ErrorNote message={errorMessage(q.error)} /></div> : !q.data.data.length ? <EmptyState title="No events" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Actor</th><th className="px-4 py-3 font-medium">Entity</th><th className="px-4 py-3 font-medium">Detail</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100 font-mono text-xs">
                {q.data.data.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 font-sans text-ink-500">{dateTime(e.at, tz)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-ink-900">{e.action}</span>{" "}
                      <Badge tone={e.outcome === "success" ? "success" : e.outcome === "denied" ? "warning" : "danger"}>{e.outcome}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">{e.actorType}{e.actorRole ? `/${e.actorRole.toLowerCase()}` : ""}<br /><span className="text-ink-400">{e.actorId ?? "—"}</span></td>
                    <td className="px-4 py-2.5 text-ink-600">{e.entityType}<br /><span className="text-ink-400">{e.entityId ?? "—"}</span></td>
                    <td className="max-w-xs break-words px-4 py-2.5 text-ink-500">{Object.keys(e.detail ?? {}).length ? JSON.stringify(e.detail) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
