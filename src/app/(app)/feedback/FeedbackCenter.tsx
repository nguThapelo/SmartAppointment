"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Plus, Star } from "lucide-react";
import type { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { dateOnly } from "@/lib/format";

interface Responses {
  averageRating: number | null;
  data: { reference: string; serviceName: string; startsAt: string; submittedAt: string; answers: { question: string; type: string; value: string }[] }[];
}
interface QSet {
  id: string;
  title: string;
  scope: "GLOBAL" | "PROVIDER";
  isActive: boolean;
  editable: boolean;
  questions: { id: string; text: string; answerType: string; isRequired: boolean }[];
}

const TYPE_LABEL: Record<string, string> = { RATING_1_5: "Rating 1–5", TEXT: "Text", YES_NO: "Yes / no", SINGLE_CHOICE: "Choice" };

export function FeedbackCenter({ role, tz }: { role: Role; tz: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const responses = useQuery({ queryKey: ["responses"], queryFn: () => api<Responses>("/api/feedback/responses") });
  const sets = useQuery({ queryKey: ["qsets"], queryFn: () => api<{ data: QSet[] }>("/api/feedback/sets") });
  const [newSet, setNewSet] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<QSet | null>(null);
  const [q, setQ] = useState({ text: "", answerType: "RATING_1_5", options: "", isRequired: true });

  const createSet = useMutation({
    mutationFn: (title: string) => api("/api/feedback/sets", { body: { title } }),
    onSuccess: () => { toast("Question set created"); setNewSet(null); void qc.invalidateQueries({ queryKey: ["qsets"] }); },
  });
  const toggleSet = useMutation({
    mutationFn: (s: QSet) => api(`/api/feedback/sets/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["qsets"] }),
  });
  const addQuestion = useMutation({
    mutationFn: () =>
      api(`/api/feedback/sets/${addTo!.id}/questions`, {
        body: {
          text: q.text,
          answerType: q.answerType,
          isRequired: q.isRequired,
          ...(q.answerType === "SINGLE_CHOICE" ? { options: q.options.split(",").map((o) => o.trim()).filter(Boolean) } : {}),
        },
      }),
    onSuccess: () => {
      toast("Question added");
      setAddTo(null);
      setQ({ text: "", answerType: "RATING_1_5", options: "", isRequired: true });
      void qc.invalidateQueries({ queryKey: ["qsets"] });
    },
  });

  return (
    <>
      <PageHeader title="Feedback" description={role === "ADMIN" ? "All client feedback, and the questions clients are asked." : "What your clients said, and your own questions."} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Average rating" value={responses.data?.averageRating != null ? <span className="inline-flex items-center gap-1">{responses.data.averageRating}<Star className="size-5 fill-amber-400 text-amber-400" /></span> : "—"} />
        <Stat label="Responses" value={responses.data?.data.length ?? "—"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent responses" />
          {responses.isPending ? <Loading /> : responses.error ? <div className="p-5"><ErrorNote message={errorMessage(responses.error)} /></div> : !responses.data.data.length ? (
            <EmptyState title="No feedback yet" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {responses.data.data.map((r) => (
                <li key={r.reference} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/bookings/${r.reference}`} className="font-medium text-ink-900 hover:underline">{r.serviceName} · {r.reference}</Link>
                    <span className="text-xs text-ink-400">{dateOnly(r.startsAt, tz)}</span>
                  </div>
                  <dl className="mt-2 space-y-1 text-sm">
                    {r.answers.map((a, i) => (
                      <div key={i} className="flex gap-2">
                        <dt className="text-ink-500">{a.question}</dt>
                        {/* Client-written text: rendered as text only. */}
                        <dd className="font-medium text-ink-800">{a.type === "RATING_1_5" ? `${a.value}/5` : a.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Question sets" action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setNewSet("")}>New set</Button>} />
          <CardBody className="space-y-4">
            {sets.isPending ? <Loading /> : sets.error ? <ErrorNote message={errorMessage(sets.error)} /> : sets.data.data.map((s) => (
              <div key={s.id} className="rounded-lg border border-ink-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink-900">{s.title}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={s.scope === "GLOBAL" ? "info" : "brand"}>{s.scope === "GLOBAL" ? "Everyone" : "Yours"}</Badge>
                    {!s.isActive && <Badge>Off</Badge>}
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-ink-600">
                  {s.questions.map((qq) => <li key={qq.id}>• {qq.text} <span className="text-xs text-ink-400">({TYPE_LABEL[qq.answerType]}{qq.isRequired ? "" : ", optional"})</span></li>)}
                </ul>
                {s.editable && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { addQuestion.reset(); setAddTo(s); }}>Add question</Button>
                    <Button size="sm" variant="ghost" loading={toggleSet.isPending && toggleSet.variables?.id === s.id} onClick={() => toggleSet.mutate(s)}>{s.isActive ? "Turn off" : "Turn on"}</Button>
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Dialog open={newSet !== null} onClose={() => setNewSet(null)} title="New question set" footer={<><Button variant="secondary" onClick={() => setNewSet(null)}>Cancel</Button><Button loading={createSet.isPending} disabled={(newSet ?? "").trim().length < 3} onClick={() => createSet.mutate(newSet!.trim())}>Create</Button></>}>
        <Field label="Title" hint={role === "ADMIN" ? "Asked after every appointment on the platform." : "Asked after your appointments only."}>
          {(p) => <Input {...p} maxLength={120} value={newSet ?? ""} onChange={(e) => setNewSet(e.target.value)} />}
        </Field>
        {createSet.error && <ErrorNote className="mt-3" message={errorMessage(createSet.error)} />}
      </Dialog>

      <Dialog open={!!addTo} onClose={() => setAddTo(null)} title={`Add question to “${addTo?.title ?? ""}”`} footer={<><Button variant="secondary" onClick={() => setAddTo(null)}>Cancel</Button><Button loading={addQuestion.isPending} disabled={q.text.trim().length < 3} onClick={() => addQuestion.mutate()}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Question">{(p) => <Input {...p} maxLength={300} value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />}</Field>
          <Field label="Answer type">
            {(p) => (
              <Select {...p} value={q.answerType} onChange={(e) => setQ({ ...q, answerType: e.target.value })}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </Field>
          {q.answerType === "SINGLE_CHOICE" && (
            <Field label="Options" hint="Comma-separated, 2–10 options.">{(p) => <Input {...p} value={q.options} onChange={(e) => setQ({ ...q, options: e.target.value })} />}</Field>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={q.isRequired} onChange={(e) => setQ({ ...q, isRequired: e.target.checked })} className="size-4 rounded border-ink-300" /> Required
          </label>
          {addQuestion.error && <ErrorNote message={errorMessage(addQuestion.error)} />}
        </div>
      </Dialog>
    </>
  );
}
