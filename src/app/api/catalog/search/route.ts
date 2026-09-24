import { searchServices } from "@/server/services/catalog";
import { searchSchema } from "@/server/validation/booking";
import { json, publicRoute } from "@/server/withApi";

export const GET = publicRoute({}, async (ctx) => {
  const { q } = ctx.query(searchSchema);
  return json({ data: await searchServices(q) });
});
