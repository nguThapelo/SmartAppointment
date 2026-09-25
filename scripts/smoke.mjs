// End-to-end smoke test against a running deployment. Never prints secrets.
//
//   BASE=https://main.xxxxx.amplifyapp.com \
//   SMOKE_CLIENT_EMAIL=lerato.mokoena@example.com SMOKE_CLIENT_PASSWORD=... \
//   SMOKE_PROVIDER_EMAIL=thandi.nkosi@example.com SMOKE_PROVIDER_PASSWORD=... \
//   npm run smoke
//
// Books a real slot as the client, approves it as the provider, then cancels
// it again — so it leaves the demo data as it found it (plus one cancelled row).

import { randomUUID } from "node:crypto";

const B = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k}`);
    process.exit(2);
  }
  return v;
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

async function session(email, password) {
  const res = await fetch(`${B}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: B },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const call = (path, opts = {}) =>
    fetch(`${B}${path}`, { redirect: "manual", ...opts, headers: { cookie, origin: B, "content-type": "application/json", ...(opts.headers ?? {}) } });
  return { status: res.status, call };
}

console.log(`Smoke testing ${B}\n`);

const health = await fetch(`${B}/api/health`).then((r) => r.json()).catch(() => ({}));
check("health endpoint reports the database is reachable", health.database === "ok");

const landing = await fetch(B).then((r) => r.text());
check("landing page renders", landing.includes("Appointment Hub"));

const protectedPage = await fetch(`${B}/dashboard`, { redirect: "manual" });
check("dashboard requires sign-in", [302, 303, 307, 308].includes(protectedPage.status));

const csrf = await fetch(`${B}/api/auth/login`, {
  method: "POST",
  headers: { origin: "https://evil.example", "content-type": "application/json" },
  body: JSON.stringify({ email: "x@y.z", password: "whatever12" }),
});
check("cross-site login is blocked (CSRF)", csrf.status === 403);

const client = await session(need("SMOKE_CLIENT_EMAIL"), need("SMOKE_CLIENT_PASSWORD"));
const provider = await session(need("SMOKE_PROVIDER_EMAIL"), need("SMOKE_PROVIDER_PASSWORD"));
check("client and provider can sign in", client.status === 200 && provider.status === 200);

const cats = await (await client.call("/api/catalog/categories")).json();
const sub = cats.data?.flatMap((c) => c.subServices).find((s) => s.providerCount > 0);
check("catalogue has a bookable service", Boolean(sub));
const option = (await (await client.call(`/api/catalog/sub-services/${sub.id}/providers`)).json()).data[0];
const { dates } = await (await client.call(`/api/availability/dates?providerServiceId=${option.providerServiceId}`)).json();
const date = dates.at(-1);
const slot = date
  ? (await (await client.call(`/api/availability/slots?providerServiceId=${option.providerServiceId}&date=${date}`)).json()).slots.at(-1)
  : undefined;
check("free slots are offered", Boolean(slot));

const key = randomUUID();
const create = () =>
  client.call("/api/bookings", {
    method: "POST",
    headers: { "idempotency-key": key },
    body: JSON.stringify({ providerServiceId: option.providerServiceId, startsAt: slot.startsAt, notes: "Smoke test" }),
  });
const created = await create();
const booking = await created.json();
check("client books a slot", created.status === 201, booking.reference);
check("a repeated submit is replayed, not duplicated", (await create()).headers.get("idempotent-replay") === "true");

const approve = await provider.call(`/api/bookings/${booking.reference}/actions/approve`, { method: "POST", body: "{}" });
const approveStatus = approve.status === 200 ? (await approve.json()).status : `HTTP ${approve.status}`;
check("provider approves it", approveStatus === "APPROVED", approveStatus);

const cancel = await client.call(`/api/bookings/${booking.reference}/actions/cancel`, { method: "POST", body: "{}" });
check("client cancels it (cleanup)", cancel.status === 200);

const ai = await client.call("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: "How do payments work?" }) });
const aiBody = await ai.json().catch(() => ({}));
check("assistant answers", ai.status === 200 && typeof aiBody.reply === "string", `provider=${aiBody.provider ?? "?"}`);

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
