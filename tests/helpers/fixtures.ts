import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { BookingStatus, PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSlots } from "@/server/services/availability";
import { createUser } from "./db";

/** A provider open 08:00–17:00 every day, offering one 60-minute R250 service. */
export async function providerWithService(opts: { paymentMode?: PaymentMode } = {}) {
  const provider = await createUser("PROVIDER");
  const category = await prisma.serviceCategory.create({ data: { name: `Hair ${randomUUID().slice(0, 6)}` } });
  const sub = await prisma.subService.create({ data: { categoryId: category.id, name: "Haircut" } });
  const ps = await prisma.providerService.create({
    data: {
      providerId: provider.user.id, subServiceId: sub.id, pricingType: "FIXED",
      rateCents: 25000, durationMin: 60, paymentMode: opts.paymentMode ?? "ONLINE",
    },
  });
  await prisma.availabilityRule.createMany({
    data: Array.from({ length: 7 }, (_, d) => ({
      providerId: provider.user.id, dayOfWeek: d, opensAt: "08:00", closesAt: "17:00", isOpen: true,
    })),
  });
  return { provider, category, sub, ps };
}

/** A date string N days from now in Johannesburg time. */
export const dayFromNow = (n: number) => formatInTimeZone(addDays(new Date(), n), "Africa/Johannesburg", "yyyy-MM-dd");

/** The first free slot for a service N days from now. */
export async function freeSlot(providerServiceId: string, daysAhead = 3, index = 0) {
  const slots = await getSlots(providerServiceId, dayFromNow(daysAhead));
  const slot = slots[index];
  if (!slot) throw new Error("fixture: no free slot");
  return slot;
}

/** Insert a booking directly (e.g. in the past, or in a given status) for scenarios the API can't create. */
export async function insertBooking(opts: {
  providerId: string;
  clientId: string;
  providerServiceId: string;
  startsAt: Date;
  status?: BookingStatus;
  paymentMode?: PaymentMode;
}) {
  return prisma.booking.create({
    data: {
      reference: `AH-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      channel: "WEB",
      status: opts.status ?? "PENDING",
      providerId: opts.providerId,
      clientId: opts.clientId,
      providerServiceId: opts.providerServiceId,
      serviceName: "Haircut",
      startsAt: opts.startsAt,
      endsAt: new Date(opts.startsAt.getTime() + 3600_000),
      priceCents: 25000,
      currency: "ZAR",
      paymentMode: opts.paymentMode ?? "ONLINE",
    },
  });
}
