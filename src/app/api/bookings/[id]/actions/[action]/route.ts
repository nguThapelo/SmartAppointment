import { z } from "zod";
import { userActor } from "@/server/actors";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { transition } from "@/server/services/booking";
import type { BookingAction } from "@/server/state/booking.machine";
import { bookingActionSchema } from "@/server/validation/booking";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

// Only user-facing actions are routable. Payment outcomes (paymentSucceeded /
// paymentFailed) and `close` can only come from the webhook or internal jobs,
// so there is no URL that marks a booking paid (audit C-3). Who may perform
// each action on which booking is decided by the state machine + ownership.
const ROUTABLE = {
  approve: "approve",
  decline: "decline",
  cancel: "cancel",
  complete: "complete",
  "no-show": "noShow",
} as const satisfies Record<string, BookingAction>;

const actionParam = z.enum(Object.keys(ROUTABLE) as [keyof typeof ROUTABLE, ...(keyof typeof ROUTABLE)[]]);

export const POST = authed<{ id: string; action: string }>({}, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const action = ROUTABLE[actionParam.parse(ctx.params.action)];
  const input = await ctx.body(bookingActionSchema);
  const booking = await transition(userActor(ctx.actor), bookingKey.parse(ctx.params.id), action, input, {
    requestId: ctx.requestId,
  });
  return json(booking);
});
