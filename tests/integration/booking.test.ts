import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as listBookings, POST as createBooking } from "@/app/api/bookings/route";
import { GET as getBooking } from "@/app/api/bookings/[id]/route";
import { GET as history } from "@/app/api/bookings/[id]/history/route";
import { POST as act } from "@/app/api/bookings/[id]/actions/[action]/route";
import { POST as rescheduleRoute } from "@/app/api/bookings/[id]/reschedule/route";
import { GET as slotsRoute } from "@/app/api/availability/slots/route";
import { createUser } from "../helpers/db";
import { dayFromNow, freeSlot, insertBooking, providerWithService } from "../helpers/fixtures";
import { call } from "../helpers/http";

async function book(token: string, body: Record<string, unknown>, key: string | null = randomUUID()) {
  return call(createBooking, "/api/bookings", {
    body,
    token,
    headers: key ? { "idempotency-key": key } : {},
  });
}

const action = (token: string, id: string, name: string, body: unknown = {}) =>
  call<{ id: string; action: string }>(act, `/api/bookings/${id}/actions/${name}`, {
    body, token, params: { id, action: name },
  });

const get = (token: string, id: string) =>
  call<{ id: string }>(getBooking, `/api/bookings/${id}`, { token, params: { id } });

describe("creating bookings", () => {
  it("books a free slot at the server-computed price", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);

    const res = await book(client.token, { providerServiceId: ps.id, startsAt: slot.startsAt, notes: "First visit" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "PENDING", priceCents: 25000, currency: "ZAR", serviceName: "Haircut" });
    expect(res.body.reference).toMatch(/^SA-[0-9A-Z]{6}$/);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.clientId).toBe(client.user.id);
    expect(row.providerId).toBe(provider.user.id);
    expect(await prisma.auditEvent.count({ where: { entityId: row.id, action: "booking.create" } })).toBe(1);
  });

  it("[C-3/H-3] rejects client-supplied status, price, clientId or providerId", async () => {
    const { ps } = await providerWithService();
    const client = await createUser("CLIENT");
    const victim = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);
    for (const extra of [{ status: "PAID" }, { priceCents: 1 }, { clientId: victim.user.id }, { providerId: "x" }]) {
      const res = await book(client.token, { providerServiceId: ps.id, startsAt: slot.startsAt, ...extra });
      expect(res.status).toBe(422);
    }
    expect(await prisma.booking.count({ where: { providerServiceId: ps.id } })).toBe(0);
  });

  it("[H-3] a client can't book on behalf of someone else", async () => {
    const { ps } = await providerWithService();
    const client = await createUser("CLIENT");
    const victim = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);
    const res = await book(client.token, { providerServiceId: ps.id, startsAt: slot.startsAt, onBehalfOfClientId: victim.user.id });
    expect(res.status).toBe(403);
  });

  it("only accepts times that are real free slots", async () => {
    const { ps } = await providerWithService();
    const client = await createUser("CLIENT");
    const offGrid = `${dayFromNow(3)}T01:17:00.000Z`;
    const res = await book(client.token, { providerServiceId: ps.id, startsAt: offGrid });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("SLOT_UNAVAILABLE");
  });

  it("providers can't create bookings", async () => {
    const { ps, provider } = await providerWithService();
    const slot = await freeSlot(ps.id);
    expect((await book(provider.token, { providerServiceId: ps.id, startsAt: slot.startsAt })).status).toBe(403);
  });

  it("[H-6] a booked slot disappears and can't be double-booked", async () => {
    const { ps } = await providerWithService();
    const a = await createUser("CLIENT");
    const b = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);

    expect((await book(a.token, { providerServiceId: ps.id, startsAt: slot.startsAt })).status).toBe(201);
    const second = await book(b.token, { providerServiceId: ps.id, startsAt: slot.startsAt });
    expect(second.status).toBe(422); // no longer offered as a slot

    const slots = await call(slotsRoute, "/api/availability/slots", { query: { providerServiceId: ps.id, date: dayFromNow(3) } });
    expect(slots.body.slots.map((s: { startsAt: string }) => s.startsAt)).not.toContain(slot.startsAt);
  });

  it("[H-6] concurrent requests for one slot: exactly one wins", async () => {
    const { ps } = await providerWithService();
    const clients = await Promise.all([createUser("CLIENT"), createUser("CLIENT"), createUser("CLIENT")]);
    const slot = await freeSlot(ps.id);
    const results = await Promise.all(clients.map((c) => book(c.token, { providerServiceId: ps.id, startsAt: slot.startsAt })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status !== 201).every((r) => [409, 422].includes(r.status))).toBe(true);
  });

  it("an Idempotency-Key makes retries safe", async () => {
    const { ps } = await providerWithService();
    const client = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);
    const key = randomUUID();
    const body = { providerServiceId: ps.id, startsAt: slot.startsAt };
    const first = await book(client.token, body, key);
    const retry = await book(client.token, body, key);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotent-replay")).toBe("true");
    expect(retry.body.id).toBe(first.body.id);
    expect(await prisma.booking.count({ where: { clientId: client.user.id } })).toBe(1);
  });

  it("requires an Idempotency-Key", async () => {
    const { ps } = await providerWithService();
    const client = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);
    expect((await book(client.token, { providerServiceId: ps.id, startsAt: slot.startsAt }, null)).status).toBe(400);
  });
});

describe("access control on existing bookings (IDOR)", () => {
  async function scenario() {
    const { ps, provider } = await providerWithService();
    const other = await providerWithService();
    const client = await createUser("CLIENT");
    const stranger = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);
    const res = await book(client.token, { providerServiceId: ps.id, startsAt: slot.startsAt });
    return { ps, provider, otherProvider: other.provider, client, stranger, booking: res.body };
  }

  it("strangers and other providers get 404, not the booking", async () => {
    const s = await scenario();
    expect((await get(s.stranger.token, s.booking.id)).status).toBe(404);
    expect((await get(s.otherProvider.token, s.booking.id)).status).toBe(404);
    expect((await get(s.stranger.token, s.booking.reference)).status).toBe(404);
    expect((await get(s.client.token, s.booking.reference)).status).toBe(200);
    expect((await get(s.provider.token, s.booking.id)).status).toBe(200);
  });

  it("another provider can't approve, and nothing changes", async () => {
    const s = await scenario();
    expect((await action(s.otherProvider.token, s.booking.id, "approve")).status).toBe(404);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: s.booking.id } })).status).toBe("PENDING");
  });

  it("a client can't approve their own booking", async () => {
    const s = await scenario();
    const res = await action(s.client.token, s.booking.id, "approve");
    expect(res.status).toBe(403);
  });

  it("contact details are shown to the provider but not echoed to other parties", async () => {
    const s = await scenario();
    expect((await get(s.provider.token, s.booking.id)).body.customer.email).toBe(s.client.user.email);
    expect((await get(s.client.token, s.booking.id)).body.customer.email).toBeNull();
  });

  it("'upcoming' leaves out cancelled bookings unless asked for", async () => {
    const s = await scenario();
    await action(s.client.token, s.booking.id, "cancel");
    const list = async (query: Record<string, string>) =>
      (await call(listBookings, "/api/bookings", { token: s.client.token, query })).body.total;
    expect(await list({ scope: "upcoming" })).toBe(0);
    expect(await list({ scope: "upcoming", status: "CANCELLED" })).toBe(1);
    expect(await list({ scope: "all" })).toBe(1);
  });

  it("lists are scoped to the caller", async () => {
    const s = await scenario();
    const admin = await createUser("ADMIN");
    const list = async (token: string) => (await call(listBookings, "/api/bookings", { token })).body;
    expect((await list(s.client.token)).total).toBe(1);
    expect((await list(s.stranger.token)).total).toBe(0);
    expect((await list(s.otherProvider.token)).total).toBe(0);
    expect((await list(s.provider.token)).total).toBe(1);
    expect((await list(admin.token)).total).toBeGreaterThanOrEqual(1);
  });
});

describe("lifecycle through the API", () => {
  it("provider approves; repeating it is rejected as an invalid transition", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const slot = await freeSlot(ps.id);
    const b = (await book(client.token, { providerServiceId: ps.id, startsAt: slot.startsAt })).body;

    const approved = await action(provider.token, b.id, "approve");
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");
    expect((await action(provider.token, b.id, "approve")).status).toBe(409);

    const h = await call<{ id: string }>(history, `/api/bookings/${b.id}/history`, { token: client.token, params: { id: b.id } });
    expect(h.body.data.map((t: { to: string }) => t.to)).toEqual(["PENDING", "APPROVED"]);
  });

  it("decline needs a reason", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const b = (await book(client.token, { providerServiceId: ps.id, startsAt: (await freeSlot(ps.id)).startsAt })).body;
    expect((await action(provider.token, b.id, "decline")).status).toBe(422);
    const ok = await action(provider.token, b.id, "decline", { reason: "Fully booked that day" });
    expect(ok.body).toMatchObject({ status: "DECLINED", declineReason: "Fully booked that day" });
  });

  it("[C-3] there is no route that marks a booking paid", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const b = (await book(client.token, { providerServiceId: ps.id, startsAt: (await freeSlot(ps.id)).startsAt })).body;
    for (const name of ["paymentSucceeded", "paid", "close", "requestPayment"]) {
      expect((await action(provider.token, b.id, name)).status).toBe(422);
    }
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING");
  });

  it("completion is only possible after the appointment starts (and is paid)", async () => {
    const { ps, provider } = await providerWithService({ paymentMode: "ON_SITE" });
    const client = await createUser("CLIENT");
    const future = await insertBooking({
      providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
      startsAt: new Date(Date.now() + 86400_000), status: "APPROVED", paymentMode: "ON_SITE",
    });
    const past = await insertBooking({
      providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
      startsAt: new Date(Date.now() - 3 * 3600_000), status: "APPROVED", paymentMode: "ON_SITE",
    });
    expect((await action(provider.token, future.id, "complete")).status).toBe(422);
    expect((await action(provider.token, past.id, "complete")).body.status).toBe("COMPLETED");
  });

  it("concurrent conflicting actions: only one applies", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const b = (await book(client.token, { providerServiceId: ps.id, startsAt: (await freeSlot(ps.id)).startsAt })).body;
    const [x, y] = await Promise.all([
      action(provider.token, b.id, "approve"),
      action(client.token, b.id, "cancel"),
    ]);
    expect([x.status, y.status].filter((s) => s === 200)).toHaveLength(1);
    const final = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(["APPROVED", "CANCELLED"]).toContain(final.status);
    expect(await prisma.bookingTransition.count({ where: { bookingId: b.id } })).toBe(2);
  });

  it("a client moving an approved booking sends it back for approval and frees the old slot", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const first = await freeSlot(ps.id, 3, 0);
    const second = await freeSlot(ps.id, 4, 2);
    const b = (await book(client.token, { providerServiceId: ps.id, startsAt: first.startsAt })).body;
    await action(provider.token, b.id, "approve");

    const moved = await call<{ id: string }>(rescheduleRoute, `/api/bookings/${b.id}/reschedule`, {
      body: { startsAt: second.startsAt }, token: client.token, params: { id: b.id },
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ status: "PENDING", startsAt: second.startsAt });

    const other = await createUser("CLIENT");
    expect((await book(other.token, { providerServiceId: ps.id, startsAt: first.startsAt })).status).toBe(201);
  });

  it("strangers can't reschedule someone else's booking", async () => {
    const { ps } = await providerWithService();
    const client = await createUser("CLIENT");
    const stranger = await createUser("CLIENT");
    const b = (await book(client.token, { providerServiceId: ps.id, startsAt: (await freeSlot(ps.id)).startsAt })).body;
    const res = await call<{ id: string }>(rescheduleRoute, `/api/bookings/${b.id}/reschedule`, {
      body: { startsAt: (await freeSlot(ps.id, 5)).startsAt }, token: stranger.token, params: { id: b.id },
    });
    expect(res.status).toBe(404);
  });
});
