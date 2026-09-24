import { userActor } from "@/server/actors";
import { confirmUpload } from "@/server/services/files";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const POST = authed<{ id: string }>({}, async (ctx) => json(await confirmUpload(userActor(ctx.actor), id.parse(ctx.params.id))));
