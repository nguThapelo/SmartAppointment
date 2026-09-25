import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError, isSlotConflict } from "@/server/errors";
import { runIdempotent } from "@/server/security/idempotency";
import { hit } from "@/server/security/rateLimit";
import { createUser } from "../helpers/db";

describe("rate limiter (Postgres-backed)", () => {
  it("allows up to the limit, then blocks", async () => {
    const key = `test:${randomUUID()}`;
    const rule = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await hit(key, rule)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it("is atomic under concurrent hits", async () => {
    const key = `test:${randomUUID()}`;
    const rule = { limit: 5, windowSeconds: 60 };
    const results = await Promise.all(Array.from({ length: 20 }, () => hit(key, rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("idempotency", () => {
  it("runs once and replays the stored response on retry", async () => {
    const key = randomUUID();
    let runs = 0;
    const exec = async () => ({ status: 201, body: { n: ++runs } });
    const first = await runIdempotent({ scope: "t", key, body: { a: 1 }, exec });
    const second = await runIdempotent({ scope: "t", key, body: { a: 1 }, exec });
    expect(runs).toBe(1);
    expect(first).toMatchObject({ status: 201, body: { n: 1 }, replayed: false });
    expect(second).toMatchObject({ status: 201, body: { n: 1 }, replayed: true });
  });

  it("rejects reuse of a key with a different body", async () => {
    const key = randomUUID();
    await runIdempotent({ scope: "t", key, body: { a: 1 }, exec: async () => ({ status: 200, body: {} }) });
    await expect(
      runIdempotent({ scope: "t", key, body: { a: 2 }, exec: async () => ({ status: 200, body: {} }) }),
    ).rejects.toMatchObject({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("releases the key after a transient failure so the retry can run", async () => {
    const key = randomUUID();
    await expect(
      runIdempotent({ scope: "t", key, body: {}, exec: async () => { throw new Error("db blip"); } }),
    ).rejects.toThrow("db blip");
    const retry = await runIdempotent({ scope: "t", key, body: {}, exec: async () => ({ status: 200, body: { ok: true } }) });
    expect(retry.replayed).toBe(false);
  });

  it("remembers permanent (4xx) failures", async () => {
    const key = randomUUID();
    const fail = async () => { throw new AppError(422, "NOPE", "nope"); };
    await expect(runIdempotent({ scope: "t", key, body: {}, exec: fail })).rejects.toBeInstanceOf(AppError);
    const replay = await runIdempotent({ scope: "t", key, body: {}, exec: async () => ({ status: 200, body: {} }) });
    expect(replay).toMatchObject({ status: 422, replayed: true });
  });
});

describe("database integrity constraints", () => {
  async function fixture() {
    const { user: provider } = await createUser("PROVIDER");
    const { user: client } = await createUser("CLIENT");
    const category = await prisma.serviceCategory.create({ data: { name: `Cat ${randomUUID()}` } });
    const sub = await prisma.subService.create({ data: { categoryId: category.id, name: "Haircut" } });
    const ps = await prisma.providerService.create({
      data: { providerId: provider.id, subServiceId: sub.id, pricingType: "FIXED", rateCents: 25000 },
    });
    const booking = (startsAt: string, endsAt: string, status: "PENDING" | "CANCELLED" = "PENDING") =>
      prisma.booking.create({
        data: {
          reference: `AH-${randomUUID().slice(0, 8)}`, channel: "WEB", status,
          providerId: provider.id, clientId: client.id, providerServiceId: ps.id,
          serviceName: "Haircut", startsAt: new Date(startsAt), endsAt: new Date(endsAt),
          priceCents: 25000, currency: "ZAR", paymentMode: "ONLINE",
        },
      });
    return { booking };
  }

  it("[H-6] refuses overlapping active bookings for the same provider", async () => {
    const { booking } = await fixture();
    await booking("2030-01-10T08:00:00Z", "2030-01-10T09:00:00Z");
    const clash = booking("2030-01-10T08:30:00Z", "2030-01-10T09:30:00Z");
    await expect(clash).rejects.toSatisfy(isSlotConflict);
  });

  it("allows back-to-back bookings and ignores cancelled ones", async () => {
    const { booking } = await fixture();
    await booking("2030-01-11T08:00:00Z", "2030-01-11T09:00:00Z", "CANCELLED");
    await booking("2030-01-11T08:00:00Z", "2030-01-11T09:00:00Z");
    await expect(booking("2030-01-11T09:00:00Z", "2030-01-11T10:00:00Z")).resolves.toBeTruthy();
  });

  it("only one of two concurrent bookings for the same slot succeeds", async () => {
    const { booking } = await fixture();
    const results = await Promise.allSettled([
      booking("2030-01-12T08:00:00Z", "2030-01-12T09:00:00Z"),
      booking("2030-01-12T08:00:00Z", "2030-01-12T09:00:00Z"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects negative prices and upper-case emails at the DB level", async () => {
    const { booking } = await fixture();
    await expect(
      prisma.$executeRaw`UPDATE "Booking" SET "priceCents" = -1 WHERE "id" = ${(await booking("2030-01-13T08:00:00Z", "2030-01-13T09:00:00Z")).id}`,
    ).rejects.toThrow();
    await expect(
      prisma.user.create({ data: { email: "UPPER@EXAMPLE.COM", passwordHash: "x", firstName: "a", lastName: "b" } }),
    ).rejects.toThrow();
  });
});
