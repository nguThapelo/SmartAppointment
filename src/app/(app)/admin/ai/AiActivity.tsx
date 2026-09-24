"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader, Stat } from "@/components/ui/card";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/format";

interface Call {
  at: string;
  tool: string;
  kind: "read" | "write";
  outcome: string;
  durationMs: number;
  errorCategory: string | null;
  userId: string;
}

const TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  ok: "success", pending_confirmation: "info", denied: "warning", invalid: "warning", error: "danger",
};

export function AiActivity({ tz }: { tz: string }) {
  const q = useQuery({ queryKey: ["ai-activity"], queryFn: () => api<{ data: Call[] }>("/api/admin/ai"), refetchInterval: 15_000 });
  const calls = q.data?.data ?? [];
  const denied = calls.filter((c) => c.outcome === "denied").length;
  const writes = calls.filter((c) => c.kind === "write").length;
  const avg = calls.length ? Math.round(calls.reduce((s, c) => s + c.durationMs, 0) / calls.length) : 0;

  return (
    <>
      <PageHeader title="AI activity" description="Tool calls made by the assistant. Metadata only — conversations and arguments are never logged." />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Recent tool calls" value={calls.length} />
        <Stat label="Write proposals" value={writes} hint="Each needs the user's confirmation" />
        <Stat label="Denied" value={denied} hint="Blocked by role or ownership checks" />
        <Stat label="Avg duration" value={`${avg} ms`} />
      </div>
      <Card className="mt-6">
        {q.isPending ? <Loading /> : q.error ? <div className="p-5"><ErrorNote message={errorMessage(q.error)} /></div> : !calls.length ? <EmptyState title="No assistant activity yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Tool</th><th className="px-4 py-3 font-medium">Outcome</th><th className="px-4 py-3 text-right font-medium">Duration</th><th className="px-4 py-3 font-medium">User</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {calls.map((c, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{dateTime(c.at, tz)}</td>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs text-ink-900">{c.tool}</span> <Badge>{c.kind}</Badge></td>
                    <td className="px-4 py-2.5"><Badge tone={TONE[c.outcome] ?? "neutral"}>{c.outcome.replace("_", " ")}</Badge>{c.errorCategory && <span className="ml-2 text-xs text-ink-400">{c.errorCategory}</span>}</td>
                    <td className="px-4 py-2.5 text-right text-ink-600">{c.durationMs} ms</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-400">{c.userId}</td>
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
