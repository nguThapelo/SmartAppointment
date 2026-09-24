import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import type { ZodType, ZodTypeDef } from "zod";
import { requireActor, type Actor } from "@/server/auth/currentUser";
import { SESSION_COOKIE } from "@/server/auth/session";
import { AppError, badRequest, forbidden, toAppError } from "@/server/errors";
import { log, type Logger } from "@/server/log";
import { clientIp } from "@/server/security/rateLimit";
import { isSameOriginRequest } from "@/server/security/origin";

// Thin wrapper every route handler goes through. It owns the cross-cutting
// steps of the request pipeline (design §2.2): correlation id, origin check,
// authentication + role, body parsing with a size cap, and a single error
// envelope that never leaks internals. Business rules stay in services.

const MAX_BODY_BYTES = 64 * 1024;

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;

interface BaseContext<P> {
  req: NextRequest;
  params: P;
  requestId: string;
  ip: string;
  log: Logger;
  /** Parse + validate the JSON body. Rejects bodies over 64 KB. */
  body<T>(schema: Schema<T>): Promise<T>;
  /** Validate query-string parameters. */
  query<T>(schema: Schema<T>): T;
  idempotencyKey: string | null;
}

export interface PublicContext<P> extends BaseContext<P> {
  actor: Actor | null;
}
export interface AuthedContext<P> extends BaseContext<P> {
  actor: Actor;
}

type RouteSegment<P> = { params: Promise<P> };

interface Options {
  /** Roles allowed to call this route. Omit for "any signed-in user". */
  roles?: readonly Role[];
  /** Skip the same-origin check (webhooks, cron — they verify signatures instead). */
  skipOriginCheck?: boolean;
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

function errorResponse(err: AppError, requestId: string) {
  const body: Record<string, unknown> = { error: err.publicMessage, code: err.code, requestId };
  if (err.status === 422 || err.status === 400) body.details = err.details;
  const headers: Record<string, string> = { "x-request-id": requestId };
  const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  if (err.status === 429 && retry) headers["retry-after"] = String(retry);
  return json(body, err.status, headers);
}

function buildContext<P>(req: NextRequest, params: P, requestId: string, rlog: Logger): BaseContext<P> {
  return {
    req,
    params,
    requestId,
    ip: clientIp(req.headers),
    log: rlog,
    idempotencyKey: req.headers.get("idempotency-key"),
    async body<T>(schema: Schema<T>) {
      const text = await req.text();
      if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw badRequest("Request body is too large");
      let data: unknown = {};
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          throw badRequest("Body must be valid JSON");
        }
      }
      return schema.parse(data);
    },
    query<T>(schema: Schema<T>) {
      return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
    },
  };
}

async function run<P>(
  req: NextRequest,
  segment: RouteSegment<P> | undefined,
  opts: Options,
  inner: (base: BaseContext<P>, rlog: Logger) => Promise<Response>,
): Promise<Response> {
  const requestId = req.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
  const started = Date.now();
  const rlog = log.child({ requestId, method: req.method, route: req.nextUrl.pathname });

  try {
    if (!opts.skipOriginCheck && !isSameOriginRequest(req.method, req.headers)) {
      rlog.metric("csrf.origin_rejected", { origin: req.headers.get("origin") });
      throw forbidden("Cross-site request blocked");
    }
    const params = (segment ? await segment.params : {}) as P;
    const res = await inner(buildContext(req, params, requestId, rlog), rlog);
    res.headers.set("x-request-id", requestId);
    rlog.info("request", { status: res.status, durationMs: Date.now() - started });
    return res;
  } catch (thrown) {
    const err = toAppError(thrown);
    if (err.status >= 500) {
      rlog.error("unhandled error", { err: thrown, durationMs: Date.now() - started });
      rlog.metric("error.unhandled");
    } else {
      if (err.status === 403) rlog.metric("authz.denied", { code: err.code });
      rlog.info("request", { status: err.status, code: err.code, durationMs: Date.now() - started });
    }
    return errorResponse(err, requestId);
  }
}

/** Route that requires a signed-in user (optionally restricted to roles). */
export function authed<P = Record<string, never>>(
  opts: Options,
  handler: (ctx: AuthedContext<P>) => Promise<Response>,
) {
  return (req: NextRequest, segment?: RouteSegment<P>) =>
    run(req, segment, opts, async (base, rlog) => {
      const actor = await requireActor(req.cookies.get(SESSION_COOKIE)?.value, opts.roles);
      return handler({ ...base, actor, log: rlog.child({ userId: actor.id, role: actor.role }) });
    });
}

/** Route open to anonymous callers; `actor` is set when a valid session exists. */
export function publicRoute<P = Record<string, never>>(
  opts: Omit<Options, "roles">,
  handler: (ctx: PublicContext<P>) => Promise<Response>,
) {
  return (req: NextRequest, segment?: RouteSegment<P>) =>
    run(req, segment, opts, async (base) => {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      const actor = token ? await requireActor(token).catch(() => null) : null;
      return handler({ ...base, actor });
    });
}
