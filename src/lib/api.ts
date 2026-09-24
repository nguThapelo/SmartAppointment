"use client";

// Browser-side API client. Same-origin fetches with the session cookie; one
// error type for every failure; an expired session sends the user to /login
// and brings them back afterwards; write calls can carry an Idempotency-Key so
// double-clicks and retries never double-book.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Pass a key (see newIdempotencyKey) for create/pay/submit actions. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export const newIdempotencyKey = () => crypto.randomUUID();

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again.");
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (res.ok) return data as T;

  const err = (data ?? {}) as { error?: string; code?: string; details?: unknown; requestId?: string };
  if (res.status === 401 && err.code === "SESSION_EXPIRED" && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // Full navigation on purpose: the session cookie changed, so server components must re-render.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${next}&expired=1`);
  }
  throw new ApiError(res.status, err.code ?? "ERROR", err.error ?? "Something went wrong.", err.details, err.requestId);
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Human message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}
