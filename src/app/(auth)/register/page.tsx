"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/feedback";
import { Field, fieldErrors, Input } from "@/components/ui/form";
import { api, ApiError, errorMessage } from "@/lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setErrors({});
    try {
      const { phone, ...rest } = form;
      await api("/api/auth/register", { body: phone.trim() ? form : rest });
      // Full navigation on purpose: the session cookie changed, so server components must re-render.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(fieldErrors(err.details));
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">Book appointments in a couple of taps.</p>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.firstName}>
          {(p) => <Input {...p} autoComplete="given-name" required value={form.firstName} onChange={set("firstName")} />}
        </Field>
        <Field label="Last name" error={errors.lastName}>
          {(p) => <Input {...p} autoComplete="family-name" required value={form.lastName} onChange={set("lastName")} />}
        </Field>
      </div>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required value={form.email} onChange={set("email")} />}
      </Field>
      <Field label="Phone (optional)" error={errors.phone}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />}
      </Field>
      <Field label="Password" hint="At least 10 characters." error={errors.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required value={form.password} onChange={set("password")} />}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">Create account</Button>
      <p className="text-center text-sm text-ink-500">
        Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
