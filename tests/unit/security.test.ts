import { describe, expect, it } from "vitest";
import { redactForLog } from "@/server/log";
import { isSameOriginRequest } from "@/server/security/origin";
import { clientIp } from "@/server/security/rateLimit";
import { signSession, verifySession } from "@/server/auth/session";

const h = (init: Record<string, string>) => new Headers(init);

describe("origin check", () => {
  it("allows safe methods from anywhere", () => {
    expect(isSameOriginRequest("GET", h({ origin: "https://evil.example" }))).toBe(true);
  });
  it("allows same-origin writes", () => {
    expect(isSameOriginRequest("POST", h({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
  });
  it("blocks cross-origin writes", () => {
    expect(isSameOriginRequest("POST", h({ origin: "https://evil.example", host: "localhost:3000" }))).toBe(false);
  });
  it("blocks writes with neither Origin nor a same-origin fetch hint", () => {
    expect(isSameOriginRequest("DELETE", h({ host: "localhost:3000" }))).toBe(false);
    expect(isSameOriginRequest("DELETE", h({ host: "localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});

describe("clientIp", () => {
  it("uses the proxy-appended (last) X-Forwarded-For entry, not the spoofable first one", () => {
    expect(clientIp(h({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }))).toBe("9.9.9.9");
  });
});

describe("log redaction", () => {
  it("drops credentials and free text by key", () => {
    const out = redactForLog({
      password: "hunter2", authorization: "Bearer x", notes: "call me", bookingId: "abc",
      nested: { sessionToken: "t", status: "PAID" },
    }) as Record<string, any>;
    expect(out.password).toBe("[redacted]");
    expect(out.authorization).toBe("[redacted]");
    expect(out.notes).toBe("[redacted]");
    expect(out.bookingId).toBe("abc");
    expect(out.nested.sessionToken).toBe("[redacted]");
    expect(out.nested.status).toBe("PAID");
  });
});

describe("session tokens", () => {
  it("round-trips and carries no role claim", async () => {
    const token = await signSession({ sub: "user123", sv: 2 });
    expect(await verifySession(token)).toEqual({ sub: "user123", sv: 2 });
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    expect(payload.role).toBeUndefined();
  });
  it("rejects tampered tokens", async () => {
    const token = await signSession({ sub: "user123", sv: 0 });
    const [head, , sig] = token.split(".");
    const evil = Buffer.from(JSON.stringify({ sub: "admin", sv: 0, exp: 9999999999 })).toString("base64url");
    expect(await verifySession(`${head}.${evil}.${sig}`)).toBeNull();
  });
});
