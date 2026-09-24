import { userActor } from "@/server/actors";
import { getForActor } from "@/server/services/booking";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({}, async (ctx) =>
  json(await getForActor(userActor(ctx.actor), bookingKey.parse(ctx.params.id))),
);
