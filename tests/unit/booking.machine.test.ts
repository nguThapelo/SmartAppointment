import type { BookingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { availableActions, decide, RULES, type BookingAction, type Party } from "@/server/state/booking.machine";

const ALL_STATUSES: BookingStatus[] = [
  "PENDING", "APPROVED", "DECLINED", "PAYMENT_PENDING", "PAID", "PAYMENT_FAILED",
  "COMPLETED", "NO_SHOW", "CANCELLED", "CLOSED",
];
const ALL_PARTIES: Party[] = ["client", "guest", "provider", "admin", "system", "webhook"];
const NOW = new Date("2030-06-01T10:00:00Z");
const FUTURE = new Date("2030-06-02T10:00:00Z");
const PAST = new Date("2030-05-31T10:00:00Z");

const facts = (status: BookingStatus, over: Partial<{ startsAt: Date; paymentMode: "ONLINE" | "ON_SITE" }> = {}) => ({
  status,
  paymentMode: over.paymentMode ?? ("ONLINE" as const),
  startsAt: over.startsAt ?? FUTURE,
});

describe("booking state machine — exhaustive", () => {
  // Every (action, status, party) combination: allowed only when the table says so.
  for (const action of Object.keys(RULES) as BookingAction[]) {
    for (const status of ALL_STATUSES) {
      for (const party of ALL_PARTIES) {
        const rule = RULES[action];
        const tableAllows = rule.from.includes(status) && rule.parties.includes(party);
        if (!tableAllows) {
          it(`${party} cannot ${action} a ${status} booking`, () => {
            expect(decide(action, facts(status, { startsAt: PAST }), party, { reason: "a reason" }, NOW).ok).toBe(false);
          });
        }
      }
    }
  }

  it("terminal states accept no actions from anyone", () => {
    for (const status of ["DECLINED", "CANCELLED", "NO_SHOW", "CLOSED"] as const) {
      for (const party of ALL_PARTIES) {
        expect(availableActions(facts(status, { startsAt: PAST }), party, NOW)).toEqual([]);
      }
    }
  });
});

describe("booking state machine — rules", () => {
  it("only the payment webhook (or system) can mark a booking PAID", () => {
    for (const party of ["client", "guest", "provider", "admin"] as const) {
      expect(decide("paymentSucceeded", facts("PAYMENT_PENDING"), party, {}, NOW).ok).toBe(false);
    }
    expect(decide("paymentSucceeded", facts("PAYMENT_PENDING"), "webhook", {}, NOW)).toEqual({ ok: true, to: "PAID" });
  });

  it("declining and staff cancellations need a reason", () => {
    expect(decide("decline", facts("PENDING"), "provider", {}, NOW)).toMatchObject({ ok: false, reason: "guard" });
    expect(decide("decline", facts("PENDING"), "provider", { reason: "Fully booked" }, NOW).ok).toBe(true);
    expect(decide("cancel", facts("APPROVED"), "provider", {}, NOW)).toMatchObject({ ok: false, reason: "guard" });
    expect(decide("cancel", facts("APPROVED"), "client", {}, NOW).ok).toBe(true);
  });

  it("customers can't cancel after the start time or once paid", () => {
    expect(decide("cancel", facts("APPROVED", { startsAt: PAST }), "client", {}, NOW).ok).toBe(false);
    expect(decide("cancel", facts("PAID"), "client", {}, NOW).ok).toBe(false);
    expect(decide("cancel", facts("PAID"), "provider", { reason: "Provider ill" }, NOW).ok).toBe(true);
  });

  it("completion requires the appointment to have started and (online) payment", () => {
    expect(decide("complete", facts("PAID", { startsAt: FUTURE }), "provider", {}, NOW).ok).toBe(false);
    expect(decide("complete", facts("PAID", { startsAt: PAST }), "provider", {}, NOW).ok).toBe(true);
    expect(decide("complete", facts("APPROVED", { startsAt: PAST }), "provider", {}, NOW).ok).toBe(false);
    expect(decide("complete", facts("APPROVED", { startsAt: PAST, paymentMode: "ON_SITE" }), "provider", {}, NOW).ok).toBe(true);
  });

  it("payment can only be requested for online-paid services", () => {
    expect(decide("requestPayment", facts("APPROVED"), "provider", {}, NOW).ok).toBe(true);
    expect(decide("requestPayment", facts("APPROVED", { paymentMode: "ON_SITE" }), "provider", {}, NOW).ok).toBe(false);
  });

  it("offers sensible actions to each party", () => {
    expect(availableActions(facts("PENDING"), "provider", NOW).sort()).toEqual(["approve", "cancel", "decline"]);
    expect(availableActions(facts("PENDING"), "client", NOW)).toEqual(["cancel"]);
    expect(availableActions(facts("PAID", { startsAt: PAST }), "provider", NOW).sort()).toEqual(["cancel", "complete", "noShow"]);
  });
});
