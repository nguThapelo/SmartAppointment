import type { BookingStatus, PaymentMode } from "@prisma/client";

// The ONLY definition of which booking status changes are legal, who may make
// them, and under which conditions. Pure data + pure functions — no DB — so it
// is exhaustively unit-tested. The booking service applies it; nothing else
// writes Booking.status (design §7.1, audit C-3).
//
//   PENDING ─approve→ APPROVED ─requestPayment→ PAYMENT_PENDING ─paymentSucceeded→ PAID ─complete→ COMPLETED ─close→ CLOSED
//      │                 │  └─complete (ON_SITE)→ COMPLETED          │ paymentFailed → PAYMENT_FAILED ─requestPayment→ …
//      ├─decline→ DECLINED
//      └─cancel→ CANCELLED   (cancel/noShow also available from later active states; see table)

/** Relationship of the caller to a specific booking, resolved by the service. */
export type Party = "client" | "guest" | "provider" | "admin" | "system" | "webhook";

export type BookingAction =
  | "approve"
  | "decline"
  | "cancel"
  | "requestPayment"
  | "paymentSucceeded"
  | "paymentFailed"
  | "complete"
  | "noShow"
  | "close";

export interface BookingFacts {
  status: BookingStatus;
  paymentMode: PaymentMode;
  startsAt: Date;
}

export interface TransitionInput {
  reason?: string | null;
}

interface Rule {
  from: readonly BookingStatus[];
  to: BookingStatus;
  parties: readonly Party[];
  /** Returns an error message when the transition isn't allowed right now. */
  guard?: (b: BookingFacts, party: Party, input: TransitionInput, now: Date) => string | null;
}

const hasStarted = (b: BookingFacts, now: Date) => b.startsAt.getTime() <= now.getTime();
const needsReason = (input: TransitionInput) =>
  input.reason && input.reason.trim().length >= 3 ? null : "Please give a reason";

export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  "PENDING", "APPROVED", "PAYMENT_PENDING", "PAID", "PAYMENT_FAILED",
];

export const TERMINAL_STATUSES: readonly BookingStatus[] = ["DECLINED", "CANCELLED", "NO_SHOW", "CLOSED"];

export const RULES: Record<BookingAction, Rule> = {
  approve: {
    from: ["PENDING"],
    to: "APPROVED",
    parties: ["provider", "admin", "system"],
  },
  decline: {
    from: ["PENDING"],
    to: "DECLINED",
    parties: ["provider", "admin"],
    guard: (_b, _p, input) => needsReason(input),
  },
  cancel: {
    from: ["PENDING", "APPROVED", "PAYMENT_PENDING", "PAYMENT_FAILED", "PAID"],
    to: "CANCELLED",
    parties: ["client", "guest", "provider", "admin"],
    guard: (b, party, input, now) => {
      if (party === "client" || party === "guest") {
        if (b.status === "PAID") return "Paid bookings can only be cancelled by the provider";
        if (hasStarted(b, now)) return "This appointment has already started";
        return null;
      }
      return needsReason(input);
    },
  },
  requestPayment: {
    from: ["APPROVED", "PAYMENT_FAILED"],
    to: "PAYMENT_PENDING",
    parties: ["provider", "admin"],
    guard: (b) => (b.paymentMode === "ONLINE" ? null : "This service is paid on site"),
  },
  paymentSucceeded: {
    // PAYMENT_FAILED → PAID covers a customer retrying successfully inside the same checkout.
    from: ["PAYMENT_PENDING", "PAYMENT_FAILED"],
    to: "PAID",
    parties: ["webhook", "system"],
  },
  paymentFailed: {
    from: ["PAYMENT_PENDING"],
    to: "PAYMENT_FAILED",
    parties: ["webhook", "system"],
  },
  complete: {
    from: ["APPROVED", "PAID"],
    to: "COMPLETED",
    parties: ["provider", "admin"],
    guard: (b, _p, _i, now) => {
      if (!hasStarted(b, now)) return "You can only complete an appointment once it has started";
      if (b.status === "APPROVED" && b.paymentMode === "ONLINE") return "This booking hasn't been paid yet";
      return null;
    },
  },
  noShow: {
    from: ["APPROVED", "PAID"],
    to: "NO_SHOW",
    parties: ["provider", "admin"],
    guard: (b, _p, _i, now) => (hasStarted(b, now) ? null : "The appointment hasn't started yet"),
  },
  close: {
    from: ["COMPLETED"],
    to: "CLOSED",
    parties: ["system"],
  },
};

export type Decision =
  | { ok: true; to: BookingStatus }
  | { ok: false; reason: "illegal_state" | "not_permitted" | "guard"; message: string };

export function decide(
  action: BookingAction,
  booking: BookingFacts,
  party: Party,
  input: TransitionInput = {},
  now: Date = new Date(),
): Decision {
  const rule = RULES[action];
  if (!rule.parties.includes(party)) {
    return { ok: false, reason: "not_permitted", message: "You can't do that on this booking" };
  }
  if (!rule.from.includes(booking.status)) {
    return {
      ok: false,
      reason: "illegal_state",
      message: `This booking is ${booking.status.toLowerCase().replace("_", " ")} and can't be changed that way`,
    };
  }
  const blocked = rule.guard?.(booking, party, input, now);
  if (blocked) return { ok: false, reason: "guard", message: blocked };
  return { ok: true, to: rule.to };
}

/** Actions a party could take on a booking right now (drives UI buttons and agent hints). */
export function availableActions(booking: BookingFacts, party: Party, now = new Date()): BookingAction[] {
  return (Object.keys(RULES) as BookingAction[]).filter((a) => {
    const d = decide(a, booking, party, { reason: "placeholder reason" }, now);
    return d.ok;
  });
}
