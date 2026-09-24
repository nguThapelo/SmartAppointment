import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { setStripeGatewayForTests } from "@/server/integrations/stripe";
import { GET as getPayment, POST as requestPaymentRoute } from "@/app/api/bookings/[id]/payment/route";
import { POST as act } from "@/app/api/bookings/[id]/actions/[action]/route";
import { POST as webhook } from "@/app/api/webhooks/stripe/route";
import { POST as cron } from "@/app/api/cron/[job]/route";
import { createUser } from "../helpers/db";
import { freeSlot, insertBooking, providerWithService } from "../helpers/fixtures";
import { call } from "../helpers/http";
import { FakeStripe, signedEvent } from "../helpers/stripe";

let stripe: FakeStripe;
beforeEach(() => {
  stripe = new FakeStripe();
  setStripeGatewayForTests(stripe);
});
afterAll(() => setStripeGatewayForTests());

async function approvedBooking(paymentMode: "ONLINE" | "ON_SITE" = "ONLINE") {
  const { ps, provider } = await providerWithService({ paymentMode });
  const client = await createUser("CLIENT");
  const slot = await freeSlot(ps.id);
  const booking = await insertBooking({
    providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
    startsAt: new Date(slot.startsAt), status: "APPROVED", paymentMode,
  });
  return { provider, client, booking };
}

const request = (token: string, id: string, key = randomUUID()) =>
  call<{ id: string }>(requestPaymentRoute, `/api/bookings/${id}/payment`, {
    method: "POST", body: {}, token, params: { id }, headers: { "idempotency-key": key },
  });

const status = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

async function deliver(payload: string, signature: string) {
  const req = new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
  const res = await webhook(req);
  return { status: res.status, body: await res.json() };
}

async function paymentRequested() {
  const ctx = await approvedBooking();
  const res = await request(ctx.provider.token, ctx.booking.id);
  const session = [...stripe.sessions.values()].at(-1)!;
  return { ...ctx, res, session };
}

describe("requesting payment", () => {
  it("provider opens a checkout for the booking's own price; only the client sees the link", async () => {
    const { provider, client, booking, res } = await paymentRequested();
    expect(res.status).toBe(201);
    expect(res.body.payment).toMatchObject({ status: "PENDING", amountCents: 25000, currency: "ZAR" });
    expect(res.body.payment.checkoutUrl).toBeNull(); // provider view
    expect(stripe.created[0]!.req.amountCents).toBe(25000);
    expect(await status(booking.id)).toBe("PAYMENT_PENDING");

    const clientView = await call<{ id: string }>(getPayment, `/api/bookings/${booking.id}/payment`, { token: client.token, params: { id: booking.id } });
    expect(clientView.body.payment.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    const providerView = await call<{ id: string }>(getPayment, `/api/bookings/${booking.id}/payment`, { token: provider.token, params: { id: booking.id } });
    expect(providerView.body.payment.checkoutUrl).toBeNull();
  });

  it("clients and other providers can't request payment", async () => {
    const { client, booking } = await approvedBooking();
    const other = await createUser("PROVIDER");
    expect((await request(client.token, booking.id)).status).toBe(403);
    expect((await request(other.token, booking.id)).status).toBe(404);
    expect(stripe.created).toHaveLength(0);
  });

  it("won't open a second checkout while one is open, even concurrently", async () => {
    const { provider, booking } = await approvedBooking();
    const results = await Promise.all([request(provider.token, booking.id), request(provider.token, booking.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it("refuses on-site services", async () => {
    const { provider, booking } = await approvedBooking("ON_SITE");
    expect((await request(provider.token, booking.id)).status).toBe(422);
  });

  it("a Stripe outage leaves the booking approved and retryable", async () => {
    const { provider, booking } = await approvedBooking();
    stripe.failNextCreate = true;
    expect((await request(provider.token, booking.id)).status).toBe(503);
    expect(await status(booking.id)).toBe("APPROVED");
    expect((await request(provider.token, booking.id)).status).toBe(201);
  });
});

describe("Stripe webhook", () => {
  it("a verified completed checkout marks the booking PAID", async () => {
    const { booking, session } = await paymentRequested();
    const ev = signedEvent("checkout.session.completed", stripe.complete(session.id));
    const res = await deliver(ev.payload, ev.signature);
    expect(res.status).toBe(200);
    expect(await status(booking.id)).toBe("PAID");
    const t = await prisma.bookingTransition.findFirstOrThrow({ where: { bookingId: booking.id, toStatus: "PAID" } });
    expect(t.actorType).toBe("WEBHOOK");
  });

  it("[H-4] a forged signature changes nothing", async () => {
    const { booking, session } = await paymentRequested();
    const ev = signedEvent("checkout.session.completed", stripe.complete(session.id), { secret: "whsec_attacker" });
    expect((await deliver(ev.payload, ev.signature)).status).toBe(400);
    expect(await status(booking.id)).toBe("PAYMENT_PENDING");
  });

  it("[H-4] replaying the same event is acknowledged but not re-applied", async () => {
    const { booking, session } = await paymentRequested();
    const ev = signedEvent("checkout.session.completed", stripe.complete(session.id));
    await deliver(ev.payload, ev.signature);
    const again = await deliver(ev.payload, ev.signature);
    expect(again.body.result).toBe("duplicate");
    expect(await prisma.bookingTransition.count({ where: { bookingId: booking.id, toStatus: "PAID" } })).toBe(1);
  });

  it("[H-2] a session whose amount doesn't match our record is rejected", async () => {
    const { booking, session } = await paymentRequested();
    const tampered = { ...stripe.complete(session.id), amountTotal: 100 };
    const ev = signedEvent("checkout.session.completed", tampered);
    await deliver(ev.payload, ev.signature);
    expect(await status(booking.id)).toBe("PAYMENT_PENDING");
    expect(await prisma.paymentEvent.count({ where: { type: "rejected" } })).toBeGreaterThan(0);
  });

  it("[H-4] a late 'expired' event can't undo a payment", async () => {
    const { booking, session } = await paymentRequested();
    const paid = signedEvent("checkout.session.completed", stripe.complete(session.id));
    await deliver(paid.payload, paid.signature);
    const late = signedEvent("checkout.session.expired", { ...session, status: "expired", paymentStatus: "unpaid" });
    await deliver(late.payload, late.signature);
    expect(await status(booking.id)).toBe("PAID");
    expect((await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } })).status).toBe("SUCCEEDED");
  });

  it("an expired checkout fails the booking's payment and a new request is allowed", async () => {
    const { provider, booking, session } = await paymentRequested();
    const ev = signedEvent("checkout.session.expired", { ...session, status: "expired", paymentStatus: "unpaid" });
    await deliver(ev.payload, ev.signature);
    expect(await status(booking.id)).toBe("PAYMENT_FAILED");
    const retry = await request(provider.token, booking.id);
    expect(retry.status).toBe(201);
    expect(retry.body.payment.attempt).toBe(2);
  });

  it("money arriving for a cancelled booking is flagged for manual refund, not un-cancelled", async () => {
    const { provider, booking, session } = await paymentRequested();
    await call<{ id: string; action: string }>(act, `/api/bookings/${booking.id}/actions/cancel`, {
      body: { reason: "Provider unavailable" }, token: provider.token, params: { id: booking.id, action: "cancel" },
    });
    const ev = signedEvent("checkout.session.completed", stripe.complete(session.id));
    await deliver(ev.payload, ev.signature);
    expect(await status(booking.id)).toBe("CANCELLED");
    expect(await prisma.paymentEvent.count({ where: { type: "needs_refund" } })).toBe(1);
  });
});

describe("reconcile + cron", () => {
  it("reconcile applies Stripe's truth for payments whose webhook never arrived", async () => {
    const { booking, session } = await paymentRequested();
    stripe.complete(session.id);
    await prisma.payment.updateMany({ where: { bookingId: booking.id }, data: { updatedAt: new Date(Date.now() - 3600_000) } });

    const res = await call<{ job: string }>(cron, "/api/cron/reconcile-payments", {
      method: "POST", params: { job: "reconcile-payments" }, origin: null,
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    expect(res.body.result.applied).toBeGreaterThanOrEqual(1);
    expect(await status(booking.id)).toBe("PAID");
  });

  it("cron endpoints require the shared secret", async () => {
    const res = await call<{ job: string }>(cron, "/api/cron/cleanup", {
      method: "POST", params: { job: "cleanup" }, origin: null, headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });
});
