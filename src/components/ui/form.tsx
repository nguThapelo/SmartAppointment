"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/format";

const control =
  "block w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 shadow-xs transition-colors focus:border-brand-500 disabled:bg-ink-50 disabled:text-ink-400 aria-[invalid=true]:border-red-400";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** Label + control + hint/error, wired together for screen readers. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, "h-10", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, "h-10 pr-8", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, "py-2", props.className)} />;
}

/** Map a 422 validation payload ({ fieldErrors }) to per-field messages. */
export function fieldErrors(details: unknown): Record<string, string> {
  const fe = (details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors ?? {};
  return Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0] ?? "Invalid value"]));
}
