"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorNote, Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";

export function LoginForm({ next, expired }: { next: string; expired: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email, password } });
      // Full navigation so server components pick up the new session.
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">Welcome back.</p>
      </div>
      {expired && <Notice tone="warning">Your session expired. Please sign in again.</Notice>}
      {error && <ErrorNote message={error} />}
      <Field label="Email">
        {(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field label="Password">
        {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Sign in
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">Forgot password?</Link>
        <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">Create account</Link>
      </div>
    </form>
  );
}
