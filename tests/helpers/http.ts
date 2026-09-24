import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";

export const ORIGIN = "http://localhost:3000";

type Handler<P> = (req: NextRequest, segment: { params: Promise<P> }) => Promise<Response>;

export interface CallOptions<P> {
  method?: string;
  body?: unknown;
  token?: string;
  params?: P;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  /** Defaults to our own origin; set to null to omit, or another URL to simulate CSRF. */
  origin?: string | null;
  ip?: string;
}

export interface CallResult {
  status: number;
  body: any;
  setCookie: string | null;
  sessionToken: string | null;
  headers: Headers;
}

/** Invoke a route handler exactly as Next would, with a real NextRequest. */
export async function call<P = Record<string, never>>(
  handler: Handler<P>,
  path: string,
  opts: CallOptions<P> = {},
): Promise<CallResult> {
  const url = new URL(path, ORIGIN);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const headers = new Headers({ host: "localhost:3000", ...opts.headers });
  if (opts.origin !== null) headers.set("origin", opts.origin ?? ORIGIN);
  if (opts.token) headers.set("cookie", `${SESSION_COOKIE}=${opts.token}`);
  if (opts.ip) headers.set("x-forwarded-for", opts.ip);
  if (opts.body !== undefined) headers.set("content-type", "application/json");

  const req = new NextRequest(url, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });

  const text = await res.text();
  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return {
    status: res.status,
    body: text ? JSON.parse(text) : null,
    setCookie,
    sessionToken: match?.[1] || null,
    headers: res.headers,
  };
}

let ipCounter = 0;
/** A fresh fake client IP per test, so rate-limit buckets don't bleed between tests. */
export const freshIp = () => `203.0.113.${(ipCounter = (ipCounter % 250) + 1)}`;
