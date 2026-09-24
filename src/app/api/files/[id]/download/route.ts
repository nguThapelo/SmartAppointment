import { userActor } from "@/server/actors";
import { downloadUrl } from "@/server/services/files";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({}, async (ctx) => json(await downloadUrl(userActor(ctx.actor), id.parse(ctx.params.id))));
