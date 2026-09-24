import { userActor } from "@/server/actors";
import { id } from "@/server/validation/common";
import { conversationMessages } from "@/server/whatsapp/service";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) =>
  json({ data: await conversationMessages(userActor(ctx.actor), id.parse(ctx.params.id)) }),
);
