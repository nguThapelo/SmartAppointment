import { userActor } from "@/server/actors";
import { historyForActor } from "@/server/services/booking";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({}, async (ctx) =>
  json({ data: await historyForActor(userActor(ctx.actor), bookingKey.parse(ctx.params.id)) }),
);
