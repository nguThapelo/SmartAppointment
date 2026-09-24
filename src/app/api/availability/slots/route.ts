import { getSlots } from "@/server/services/availability";
import { slotsQuerySchema } from "@/server/validation/booking";
import { json, publicRoute } from "@/server/withApi";

export const GET = publicRoute({}, async (ctx) => {
  const { providerServiceId, date } = ctx.query(slotsQuerySchema);
  return json({ date, slots: await getSlots(providerServiceId, date) });
});
