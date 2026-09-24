"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorNote, Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await api<{ message: string }>("/api/auth/password/forgot", { body: { email } });
      setDone(r.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-500">We’ll email you a link that works for 30 minutes.</p>
      </div>
      {done ? (
        <Notice tone="success">{done}</Notice>
      ) : (
        <>
          {error && <ErrorNote message={error} />}
          <Field label="Email">
            {(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" size="lg" loading={pending} className="w-full">Send reset link</Button>
        </>
      )}
      <p className="text-center text-sm"><Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">Back to sign in</Link></p>
    </form>
  );
}
