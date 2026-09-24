import { listProvidersForSubService } from "@/server/services/pricing";
import { id } from "@/server/validation/common";
import { json, publicRoute } from "@/server/withApi";

export const GET = publicRoute<{ id: string }>({}, async (ctx) =>
  json({ data: await listProvidersForSubService(id.parse(ctx.params.id)) }),
);
