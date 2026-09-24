"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNote } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import type { BookingAction, BookingDTO } from "./types";

// Buttons for the actions the SERVER says this user can take right now
// (BookingDTO.availableActions). The server re-checks everything on submit.

const UI: Partial<Record<BookingAction, { label: string; path: string; variant: "primary" | "secondary" | "danger"; reason?: "required" | "optional"; confirm: string }>> = {
  approve: { label: "Approve", path: "approve", variant: "primary", confirm: "Approve this booking? The client will be notified." },
  decline: { label: "Decline", path: "decline", variant: "danger", reason: "required", confirm: "Decline this booking request?" },
  complete: { label: "Mark completed", path: "complete", variant: "primary", confirm: "Mark this appointment as completed?" },
  noShow: { label: "No-show", path: "no-show", variant: "secondary", confirm: "Record that the client didn't show up?" },
  cancel: { label: "Cancel booking", path: "cancel", variant: "danger", reason: "optional", confirm: "Cancel this booking?" },
};

export function BookingActions({ booking, isStaff }: { booking: BookingDTO; isStaff: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<BookingAction | null>(null);
  const [reason, setReason] = useState("");

  const run = useMutation({
    mutationFn: (action: BookingAction) =>
      api<BookingDTO>(`/api/bookings/${booking.reference}/actions/${UI[action]!.path}`, {
        body: reason.trim() ? { reason: reason.trim() } : {},
      }),
    onSuccess: (_d, action) => {
      toast(`${UI[action]!.label} — done`);
      setOpen(null);
      setReason("");
      void qc.invalidateQueries();
    },
  });

  const available = booking.availableActions.filter((a) => UI[a]);
  if (!available.length) return null;
  const current = open ? UI[open]! : null;
  // Staff must always give a reason when cancelling; clients may.
  const reasonMode = open === "cancel" && isStaff ? "required" : current?.reason;
  const reasonMissing = reasonMode === "required" && reason.trim().length < 3;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((a) => (
          <Button key={a} variant={UI[a]!.variant} onClick={() => { run.reset(); setOpen(a); }}>
            {UI[a]!.label}
          </Button>
        ))}
      </div>
      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={current?.label ?? ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)} disabled={run.isPending}>Back</Button>
            <Button variant={current?.variant === "danger" ? "danger" : "primary"} loading={run.isPending} disabled={reasonMissing} onClick={() => open && run.mutate(open)}>
              {current?.label}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-600">{current?.confirm}</p>
          {reasonMode && (
            <Field label={reasonMode === "required" ? "Reason" : "Reason (optional)"} hint="Shared with the other party.">
              {(p) => <Textarea {...p} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          )}
          {run.error && <ErrorNote message={errorMessage(run.error)} />}
        </div>
      </Dialog>
    </>
  );
}
