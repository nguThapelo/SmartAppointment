"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorNote, Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/auth/password/reset", { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Notice tone="success">Your password was changed. You’ve been signed out of other devices.</Notice>
        <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline">Sign in</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Choose a new password</h1>
      {!token && <ErrorNote message="This link is incomplete. Request a new one." />}
      {error && <ErrorNote message={error} />}
      <Field label="New password" hint="At least 10 characters.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" loading={pending} disabled={!token} className="w-full">Set password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
