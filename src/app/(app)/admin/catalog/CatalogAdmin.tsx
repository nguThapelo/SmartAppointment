"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNote, Loading } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";

interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  subServices: { id: string; name: string; description: string | null; defaultDuration: number; isActive: boolean; providerCount: number }[];
}

type Draft =
  | { kind: "category"; name: string; description: string }
  | { kind: "sub"; categoryId: string; categoryName: string; name: string; description: string; defaultDuration: string };

export function CatalogAdmin() {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const cats = useQuery({ queryKey: ["categories", "admin"], queryFn: () => api<{ data: Category[] }>("/api/catalog/categories") });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["categories"] });

  const create = useMutation({
    mutationFn: (d: Draft) =>
      d.kind === "category"
        ? api("/api/catalog/categories", { body: { name: d.name, ...(d.description ? { description: d.description } : {}) } })
        : api("/api/catalog/sub-services", { body: { categoryId: d.categoryId, name: d.name, defaultDuration: Number(d.defaultDuration), ...(d.description ? { description: d.description } : {}) } }),
    onSuccess: () => { toast("Added"); setDraft(null); refresh(); },
  });
  const toggle = useMutation({
    mutationFn: (t: { kind: "category" | "sub"; id: string; isActive: boolean }) =>
      api(t.kind === "category" ? `/api/catalog/categories/${t.id}` : `/api/catalog/sub-services/${t.id}`, { method: "PATCH", body: { isActive: !t.isActive } }),
    onSuccess: refresh,
  });

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Service categories and the services providers can offer. Hidden items can't be booked."
        action={<Button icon={<Plus className="size-4" />} onClick={() => { create.reset(); setDraft({ kind: "category", name: "", description: "" }); }}>New category</Button>}
      />
      {cats.isPending ? <Loading /> : cats.error ? <ErrorNote message={errorMessage(cats.error)} /> : (
        <div className="space-y-4">
          {cats.data.data.map((c) => (
            <Card key={c.id}>
              <CardHeader
                title={<span className="flex items-center gap-2">{c.name} {!c.isActive && <Badge>Hidden</Badge>}</span>}
                description={c.description ?? undefined}
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => { create.reset(); setDraft({ kind: "sub", categoryId: c.id, categoryName: c.name, name: "", description: "", defaultDuration: "60" }); }}>Service</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ kind: "category", id: c.id, isActive: c.isActive })}>{c.isActive ? "Hide" : "Show"}</Button>
                  </div>
                }
              />
              <ul className="divide-y divide-ink-100">
                {c.subServices.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-ink-900">{s.name} {!s.isActive && <Badge>Hidden</Badge>}</p>
                      <p className="text-ink-500">{s.defaultDuration} min default · {s.providerCount} provider{s.providerCount === 1 ? "" : "s"}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ kind: "sub", id: s.id, isActive: s.isActive })}>{s.isActive ? "Hide" : "Show"}</Button>
                  </li>
                ))}
                {!c.subServices.length && <li className="px-5 py-3 text-sm text-ink-400">No services yet.</li>}
              </ul>
            </Card>
          ))}
          {toggle.error && <ErrorNote message={errorMessage(toggle.error)} />}
        </div>
      )}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.kind === "sub" ? `New service in ${draft.categoryName}` : "New category"}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button loading={create.isPending} disabled={(draft?.name.trim().length ?? 0) < 2} onClick={() => draft && create.mutate(draft)}>Add</Button></>}
      >
        {draft && (
          <div className="space-y-3">
            <Field label="Name">{(p) => <Input {...p} maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Description (optional)">{(p) => <Input {...p} maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}</Field>
            {draft.kind === "sub" && (
              <Field label="Default duration (min)">{(p) => <Input {...p} type="number" min={5} max={720} value={draft.defaultDuration} onChange={(e) => setDraft({ ...draft, defaultDuration: e.target.value })} />}</Field>
            )}
            {create.error && <ErrorNote message={errorMessage(create.error)} />}
          </div>
        )}
      </Dialog>
    </>
  );
}
