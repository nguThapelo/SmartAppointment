"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";

export function AccountSettings({ name, email, role }: { name: string; email: string; role: string }) {
  const toast = useToast();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const change = useMutation({
    mutationFn: () => api("/api/auth/password/change", { body: pw }),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "" });
      toast("Password changed. Other devices were signed out.");
    },
  });
  const logoutAll = useMutation({
    mutationFn: () => api("/api/auth/logout-all", { method: "POST" }),
    // Full navigation on purpose: the session cookie changed, so server components must re-render.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    onSuccess: () => window.location.assign("/login"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    change.mutate();
  }

  return (
    <>
      <PageHeader title="Account" />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
              <dt className="text-ink-500">Name</dt><dd className="text-ink-900">{name}</dd>
              <dt className="text-ink-500">Email</dt><dd className="text-ink-900">{email}</dd>
              <dt className="text-ink-500">Role</dt><dd className="capitalize text-ink-900">{role.toLowerCase()}</dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" description="Signs you out on every other device." />
          <CardBody>
            <form onSubmit={onSubmit} className="max-w-sm space-y-3">
              <Field label="Current password">{(p) => <Input {...p} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
              <Field label="New password" hint="At least 10 characters.">{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}</Field>
              {change.error && <ErrorNote message={errorMessage(change.error)} />}
              <Button type="submit" loading={change.isPending} disabled={!pw.currentPassword || pw.newPassword.length < 10}>Change password</Button>
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Sessions" description="Lost a device? Sign out everywhere, including here." />
          <CardBody>
            <Button variant="danger" loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}>Sign out everywhere</Button>
            {logoutAll.error && <ErrorNote className="mt-3" message={errorMessage(logoutAll.error)} />}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
