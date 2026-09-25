import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, formatISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

// Demo data for showcase / staging environments: a small catalogue, two providers
// with hours and prices, a client with bookings in several states, feedback
// questions and a WhatsApp channel. Idempotent — re-running changes nothing
// that already exists. Enabled with SEED_DEMO=true; the demo accounts'
// password comes from SEED_DEMO_PASSWORD (never hard-coded).

const TZ = "Africa/Johannesburg";

const CATALOG = [
  {
    name: "Hair & Beauty",
    description: "Cuts, colour and nails",
    subs: [
      { name: "Haircut", description: "Wash, cut and style", duration: 45 },
      { name: "Hair colour", description: "Full colour or highlights", duration: 90 },
      { name: "Manicure", description: "Classic manicure", duration: 45 },
    ],
  },
  {
    name: "Wellness",
    description: "Massage and physiotherapy",
    subs: [
      { name: "Massage", description: "60-minute full body massage", duration: 60 },
      { name: "Physiotherapy", description: "Assessment and treatment", duration: 45 },
    ],
  },
  {
    name: "Home Services",
    description: "Trades that come to you",
    subs: [{ name: "Plumbing call-out", description: "Diagnosis and minor repairs", duration: 60 }],
  },
];

const at = (daysFromNow: number, hhmm: string) =>
  fromZonedTime(`${formatISO(addDays(new Date(), daysFromNow), { representation: "date" })}T${hhmm}:00`, TZ);

export async function seedDemo(prisma: PrismaClient) {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set SEED_DEMO_PASSWORD (10+ chars) to seed demo accounts");
  const passwordHash = await bcrypt.hash(password, 12);

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const subIds: Record<string, string> = {};
  for (const [i, c] of CATALOG.entries()) {
    const cat = await prisma.serviceCategory.upsert({
      where: { name: c.name },
      create: { name: c.name, description: c.description, sortOrder: i },
      update: {},
    });
    for (const s of c.subs) {
      const sub = await prisma.subService.upsert({
        where: { categoryId_name: { categoryId: cat.id, name: s.name } },
        create: { categoryId: cat.id, name: s.name, description: s.description, defaultDuration: s.duration },
        update: {},
      });
      subIds[s.name] = sub.id;
    }
  }

  // ── People ────────────────────────────────────────────────────────────────
  const person = (email: string, firstName: string, lastName: string, role: "PROVIDER" | "CLIENT", phone?: string) =>
    prisma.user.upsert({
      where: { email },
      create: { email, firstName, lastName, role, phone, passwordHash },
      update: {},
    });
  const thandi = await person("thandi.nkosi@example.com", "Thandi", "Nkosi", "PROVIDER", "+27821000001");
  const sipho = await person("sipho.dube@example.com", "Sipho", "Dube", "PROVIDER", "+27821000002");
  const lerato = await person("lerato.mokoena@example.com", "Lerato", "Mokoena", "CLIENT", "+27821000003");

  // ── Prices & hours ────────────────────────────────────────────────────────
  const offer = async (providerId: string, sub: string, rateCents: number, durationMin: number, paymentMode: "ONLINE" | "ON_SITE" = "ONLINE") =>
    prisma.providerService.upsert({
      where: { providerId_subServiceId: { providerId, subServiceId: subIds[sub]! } },
      create: { providerId, subServiceId: subIds[sub]!, pricingType: "FIXED", rateCents, durationMin, paymentMode },
      update: {},
    });
  const haircut = await offer(thandi.id, "Haircut", 25000, 45);
  await offer(thandi.id, "Hair colour", 65000, 90);
  const manicure = await offer(thandi.id, "Manicure", 18000, 45, "ON_SITE");
  const massage = await offer(sipho.id, "Massage", 55000, 60);
  await offer(sipho.id, "Physiotherapy", 48000, 45);

  for (const providerId of [thandi.id, sipho.id]) {
    if ((await prisma.availabilityRule.count({ where: { providerId } })) === 0) {
      await prisma.availabilityRule.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          providerId,
          dayOfWeek: d,
          isOpen: d !== 0,
          opensAt: d === 6 ? "09:00" : "08:00",
          closesAt: d === 6 ? "13:00" : "17:00",
        })),
      });
    }
  }

  // ── Feedback questions ────────────────────────────────────────────────────
  if ((await prisma.feedbackQuestionSet.count()) === 0) {
    await prisma.feedbackQuestionSet.create({
      data: {
        scope: "GLOBAL",
        title: "Service quality",
        questions: {
          create: [
            { text: "How would you rate your appointment overall?", answerType: "RATING_1_5", sortOrder: 0 },
            { text: "Would you recommend this provider?", answerType: "YES_NO", sortOrder: 1 },
            { text: "Anything we could do better?", answerType: "TEXT", isRequired: false, sortOrder: 2 },
          ],
        },
      },
    });
    await prisma.feedbackQuestionSet.create({
      data: {
        scope: "PROVIDER",
        ownerId: thandi.id,
        title: "Salon experience",
        questions: {
          create: [{
            text: "What did you enjoy most?", answerType: "SINGLE_CHOICE", isRequired: false,
            options: ["The result", "The atmosphere", "Being on time", "The price"],
          }],
        },
      },
    });
  }

  // ── Bookings in a few states (only once) ──────────────────────────────────
  if ((await prisma.booking.count({ where: { clientId: lerato.id } })) === 0) {
    const make = async (ref: string, ps: { id: string; providerId: string; rateCents: number; currency: string; paymentMode: "ONLINE" | "ON_SITE"; durationMin: number }, name: string, startsAt: Date, status: "PENDING" | "APPROVED" | "COMPLETED" | "CLOSED") => {
      const b = await prisma.booking.create({
        data: {
          reference: ref, channel: "WEB", status, providerId: ps.providerId, clientId: lerato.id, providerServiceId: ps.id,
          serviceName: name, startsAt, endsAt: new Date(startsAt.getTime() + ps.durationMin * 60_000),
          priceCents: ps.rateCents, currency: ps.currency, paymentMode: ps.paymentMode,
          notes: status === "PENDING" ? "First time — shoulder-length hair." : null,
        },
      });
      await prisma.bookingTransition.create({ data: { bookingId: b.id, toStatus: "PENDING", action: "create", actorType: "USER", actorId: lerato.id } });
      if (status !== "PENDING") {
        await prisma.bookingTransition.create({ data: { bookingId: b.id, fromStatus: "PENDING", toStatus: "APPROVED", action: "approve", actorType: "USER", actorId: ps.providerId } });
      }
      if (status === "COMPLETED" || status === "CLOSED") {
        await prisma.bookingTransition.create({ data: { bookingId: b.id, fromStatus: "APPROVED", toStatus: "COMPLETED", action: "complete", actorType: "USER", actorId: ps.providerId } });
      }
      return b;
    };
    await make("AH-DEMO01", haircut, "Haircut", at(5, "10:00"), "PENDING");
    await make("AH-DEMO02", massage, "Massage", at(8, "14:00"), "APPROVED");
    await make("AH-DEMO03", manicure, "Manicure", at(-6, "11:00"), "COMPLETED");
  }

  // ── WhatsApp channel for Thandi ───────────────────────────────────────────
  const phoneNumberId = process.env.SEED_WHATSAPP_PHONE_NUMBER_ID || "000000000000000";
  await prisma.whatsAppChannel.upsert({
    where: { phoneNumberId },
    create: {
      providerId: thandi.id,
      phoneNumberId,
      displayNumber: process.env.SEED_WHATSAPP_DISPLAY_NUMBER || "+1 555 000 0000",
      name: "Thandi's Salon",
      welcomeMessage: "Hi! 👋 Welcome to Thandi's Salon.",
      autoApprove: true,
      // A placeholder id can't receive messages, so keep it off until a real number is configured.
      isActive: phoneNumberId !== "000000000000000",
    },
    update: {},
  });

  // ── Master data ───────────────────────────────────────────────────────────
  const reasons = await prisma.masterDataType.upsert({
    where: { code: "cancellation_reasons" },
    create: { code: "cancellation_reasons", name: "Cancellation reasons" },
    update: {},
  });
  for (const [i, label] of ["Schedule conflict", "Provider unavailable", "Feeling unwell", "Other"].entries()) {
    await prisma.masterDataItem.upsert({
      where: { typeId_value: { typeId: reasons.id, value: label.toLowerCase().replace(/\s+/g, "_") } },
      create: { typeId: reasons.id, label, value: label.toLowerCase().replace(/\s+/g, "_"), sortOrder: i },
      update: {},
    });
  }

  console.log("Demo data ready: lerato.mokoena@ / thandi.nkosi@ / sipho.dube@example.com");
}
