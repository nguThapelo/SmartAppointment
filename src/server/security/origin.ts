// CSRF defence for cookie-authenticated requests: a state-changing request must
// come from our own origin. SameSite=Lax on the session cookie already blocks
// most cross-site POSTs; this check closes the rest (e.g. same-site subdomains,
// older browsers). Webhooks and cron routes authenticate by signature/secret
// instead and opt out.

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutating(method: string) {
  return MUTATING.has(method.toUpperCase());
}

function allowedOrigins(headers: Headers): Set<string> {
  const out = new Set<string>();
  if (process.env.APP_URL) {
    try {
      out.add(new URL(process.env.APP_URL).origin);
    } catch {
      /* invalid APP_URL is reported by env() */
    }
  }
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    out.add(`${proto}://${host}`);
  }
  return out;
}

export function isSameOriginRequest(method: string, headers: Headers): boolean {
  if (!isMutating(method)) return true;
  const origin = headers.get("origin");
  if (origin) return allowedOrigins(headers).has(origin);
  // No Origin header: only accept when the browser says it's same-origin.
  const site = headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}
