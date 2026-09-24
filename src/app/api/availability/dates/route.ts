import { z } from "zod";
import { nextAvailableDates } from "@/server/services/availability";
import { id } from "@/server/validation/common";
import { json, publicRoute } from "@/server/withApi";

const schema = z.object({ providerServiceId: id }).strict();
const WINDOW_DAYS = 14;

// Which of the next two weeks have at least one free slot (drives the date strip).
export const GET = publicRoute({}, async (ctx) => {
  const { providerServiceId } = ctx.query(schema);
  return json({ dates: await nextAvailableDates(providerServiceId, WINDOW_DAYS, WINDOW_DAYS - 1) });
});
