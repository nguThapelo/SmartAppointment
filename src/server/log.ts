// Structured JSON logging (ported from peach-payment lib/log.js).
//
// One JSON object per line on stdout/stderr → Amplify ships it to CloudWatch
// Logs, where metric filters turn `level: "metric"` lines into alarms.
// Redaction is by KEY NAME: anything that looks like a credential, token or
// free-text body is dropped before it reaches the log.

type Ctx = Record<string, unknown>;

const REDACT_KEY = /pass(word)?|secret|token|authorization|cookie|card|cvv|cvc|pan\b|body|content|notes?$|message$/i;
const MAX_STRING = 300;

function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Ctx = {};
    for (const [k, v] of Object.entries(value as Ctx)) {
      out[k] = REDACT_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: "info" | "warn" | "error" | "metric", msg: string, ctx?: Ctx) {
  if (process.env.NODE_ENV === "test" && process.env.LOG_IN_TESTS !== "true") return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "smart-appointment",
    msg,
    ...(redact(ctx ?? {}) as Ctx),
  });
  if (level === "error") console.error(line);
  else if (level === "info") console.log(line);
  else console.warn(line);
}

export interface Logger {
  info(msg: string, ctx?: Ctx): void;
  warn(msg: string, ctx?: Ctx): void;
  error(msg: string, ctx?: Ctx): void;
  /** Named operational event for CloudWatch metric filters, e.g. "authz.denied". */
  metric(name: string, ctx?: Ctx): void;
  child(bound: Ctx): Logger;
}

function make(bound: Ctx): Logger {
  return {
    info: (msg, ctx) => write("info", msg, { ...bound, ...ctx }),
    warn: (msg, ctx) => write("warn", msg, { ...bound, ...ctx }),
    error: (msg, ctx) => write("error", msg, { ...bound, ...ctx }),
    metric: (name, ctx) => write("metric", name, { ...bound, ...ctx, metric: name }),
    child: (more) => make({ ...bound, ...more }),
  };
}

export const log = make({});

export { redact as redactForLog };
