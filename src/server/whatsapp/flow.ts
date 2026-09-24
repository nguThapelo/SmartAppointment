import type { WhatsAppChannel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ServiceActor, ServiceCtx } from "@/server/actors";
import { AppError } from "@/server/errors";
import { getSlots, nextAvailableDates } from "@/server/services/availability";
import { create, listForActor, previewCreate, reschedule, transition } from "@/server/services/booking";
import { priceFor } from "@/server/services/pricing";
import { email as emailSchema, personName } from "@/server/validation/common";
import { fmtWhen, T } from "./templates";

// The WhatsApp booking conversation, as a small state machine.
//
// It has NO booking logic of its own: every read and write goes through the
// same services as the web app, with a `whatsapp` actor (channel + sender's
// phone). So a WhatsApp customer can only ever see or change bookings made
// from their own number on this channel, and bookings obey the same slot,
// price and state-machine rules as everywhere else.

export type Step =
  | "IDLE" | "MENU" | "SERVICE" | "DATE" | "TIME" | "NAME" | "EMAIL" | "CONFIRM"
  | "PICK_CANCEL" | "CONFIRM_CANCEL" | "PICK_RESCHEDULE" | "RESCHEDULE_DATE" | "RESCHEDULE_TIME" | "CONFIRM_RESCHEDULE";

// Conversation state lives in a JSON column; it's re-validated on every
// message, and anything unexpected simply resets the conversation.
const sessionSchema = z
  .object({
    services: z.array(z.object({ id: z.string(), name: z.string() })).max(20).optional(),
    serviceId: z.string().optional(),
    serviceName: z.string().optional(),
    dates: z.array(z.string()).max(10).optional(),
    date: z.string().optional(),
    slots: z.array(z.object({ startsAt: z.string(), label: z.string() })).max(40).optional(),
    startsAt: z.string().optional(),
    name: z.string().optional(),
    email: z.string().nullable().optional(),
    bookings: z.array(z.object({ id: z.string(), ref: z.string(), label: z.string(), startsAt: z.string() })).max(10).optional(),
    bookingId: z.string().optional(),
  })
  .strict();
export type Session = z.infer<typeof sessionSchema>;

export interface FlowInput {
  channel: WhatsAppChannel & { provider: { timezone: string } };
  phone: string;
  profileName: string | null;
  step: string;
  session: unknown;
  text: string;
}
export interface FlowResult {
  reply: string;
  step: Step;
  session: Session;
}

const pick = <T>(text: string, items: T[] | undefined): T | undefined => {
  const i = Number.parseInt(text.trim(), 10);
  return items && Number.isInteger(i) && i >= 1 && i <= items.length ? items[i - 1] : undefined;
};
const yes = (t: string) => ["YES", "Y", "CONFIRM", "1"].includes(t.trim().toUpperCase());
const no = (t: string) => ["NO", "N", "2"].includes(t.trim().toUpperCase());
const isMenuCommand = (t: string) => ["MENU", "HI", "HELLO", "HEY", "START", "0"].includes(t.trim().toUpperCase());

export async function runFlow(input: FlowInput, ctx: ServiceCtx = {}): Promise<FlowResult> {
  const { channel, phone, text } = input;
  const tz = channel.provider.timezone;
  const actor: ServiceActor = { kind: "whatsapp", phone, channelId: channel.id, name: input.profileName ?? undefined };
  const parsed = sessionSchema.safeParse(input.session ?? {});
  const s: Session = parsed.success ? parsed.data : {};
  let step = (parsed.success ? input.step : "IDLE") as Step;

  const menu = (): FlowResult => ({ reply: T.mainMenu(channel.welcomeMessage), step: "MENU", session: {} });
  if (isMenuCommand(text) || step === "IDLE") return menu();
  if (text.trim().toUpperCase() === "HELP") return { reply: T.help(), step, session: s };

  async function listServices() {
    const rows = await prisma.providerService.findMany({
      where: { providerId: channel.providerId, isActive: true, subService: { isActive: true, category: { isActive: true } } },
      include: { subService: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    return rows.map((r) => ({ id: r.id, name: r.subService.name, priceCents: priceFor(r), currency: r.currency, durationMin: r.durationMin }));
  }

  async function upcoming() {
    const list = await listForActor(actor, { page: 1, pageSize: 10, scope: "upcoming" });
    return list.data
      .filter((b) => ["PENDING", "APPROVED", "PAYMENT_PENDING", "PAYMENT_FAILED", "PAID"].includes(b.status))
      .map((b) => ({
        id: b.id,
        ref: b.reference,
        startsAt: b.startsAt,
        label: `${b.serviceName} — ${fmtWhen(b.startsAt, tz)} (${b.reference}, ${b.status.toLowerCase().replace("_", " ")})`,
      }));
  }

  async function offerTimes(date: string, serviceId: string, excludeBookingId?: string) {
    const slots = (await getSlots(serviceId, date, { excludeBookingId, maxAdvanceDays: channel.maxAdvanceDays }))
      .slice(0, 20)
      .map(({ startsAt, label }) => ({ startsAt, label }));
    return slots;
  }

  try {
    switch (step) {
      case "MENU": {
        switch (text.trim()) {
          case "1": {
            const services = await listServices();
            return { reply: T.serviceList(services), step: services.length ? "SERVICE" : "MENU", session: { services: services.map(({ id, name }) => ({ id, name })) } };
          }
          case "2":
            return { reply: T.myBookings((await upcoming()).map((b) => b.label)), step: "MENU", session: {} };
          case "3": {
            const bookings = await upcoming();
            return { reply: T.pickBooking(bookings.map((b) => b.label), "reschedule"), step: bookings.length ? "PICK_RESCHEDULE" : "MENU", session: { bookings } };
          }
          case "4": {
            const bookings = await upcoming();
            return { reply: T.pickBooking(bookings.map((b) => b.label), "cancel"), step: bookings.length ? "PICK_CANCEL" : "MENU", session: { bookings } };
          }
          case "5":
            return { reply: T.help(), step: "MENU", session: {} };
          default:
            return { reply: T.invalidChoice(), step, session: s };
        }
      }

      // ── Book ──────────────────────────────────────────────────────────
      case "SERVICE": {
        const svc = pick(text, s.services);
        if (!svc) return { reply: T.invalidChoice(), step, session: s };
        const dates = await nextAvailableDates(svc.id, 6, channel.maxAdvanceDays);
        return { reply: T.dateList(dates, svc.name), step: dates.length ? "DATE" : "MENU", session: { serviceId: svc.id, serviceName: svc.name, dates } };
      }
      case "DATE": {
        const date = pick(text, s.dates);
        if (!date || !s.serviceId) return { reply: T.invalidChoice(), step, session: s };
        const slots = await offerTimes(date, s.serviceId);
        return { reply: T.timeList(slots, date), step: slots.length ? "TIME" : "MENU", session: { ...s, date, slots } };
      }
      case "TIME": {
        const slot = pick(text, s.slots);
        if (!slot) return { reply: T.invalidChoice(), step, session: s };
        return { reply: T.askName(), step: "NAME", session: { ...s, startsAt: slot.startsAt } };
      }
      case "NAME": {
        const name = personName.safeParse(text);
        if (!name.success || name.data.length < 2) return { reply: T.askName(), step, session: s };
        return { reply: T.askEmail(), step: "EMAIL", session: { ...s, name: name.data } };
      }
      case "EMAIL": {
        let email: string | null = null;
        if (text.trim().toLowerCase() !== "skip") {
          const parsedEmail = emailSchema.safeParse(text);
          if (!parsedEmail.success) return { reply: T.invalidEmail(), step, session: s };
          email = parsedEmail.data;
        }
        const next = { ...s, email };
        const preview = await previewCreate(actor, { providerServiceId: s.serviceId!, startsAt: s.startsAt! }, { name: s.name!, phone, email: email ?? undefined });
        return {
          reply: T.confirm({ service: preview.serviceName, when: preview.localTime, price: T.money(preview.priceCents, preview.currency), name: s.name!, email }),
          step: "CONFIRM",
          session: next,
        };
      }
      case "CONFIRM": {
        if (no(text)) return { reply: T.keptAsIs(), step: "MENU", session: {} };
        if (!yes(text)) return { reply: T.invalidChoice(), step, session: s };
        const booking = await create(
          actor,
          { providerServiceId: s.serviceId!, startsAt: s.startsAt! },
          ctx,
          { name: s.name!, phone, email: s.email ?? undefined },
        );
        return { reply: T.booked(booking.reference, booking.status === "APPROVED"), step: "MENU", session: {} };
      }

      // ── Cancel ────────────────────────────────────────────────────────
      case "PICK_CANCEL": {
        const b = pick(text, s.bookings);
        if (!b) return { reply: T.invalidChoice(), step, session: s };
        return { reply: T.confirmCancel(b.label), step: "CONFIRM_CANCEL", session: { bookingId: b.id, bookings: [b] } };
      }
      case "CONFIRM_CANCEL": {
        if (no(text)) return { reply: T.keptAsIs(), step: "MENU", session: {} };
        if (!yes(text) || !s.bookingId) return { reply: T.invalidChoice(), step, session: s };
        const b = await transition(actor, s.bookingId, "cancel", {}, ctx);
        return { reply: T.cancelled(b.reference), step: "MENU", session: {} };
      }

      // ── Reschedule ────────────────────────────────────────────────────
      case "PICK_RESCHEDULE": {
        const b = pick(text, s.bookings);
        if (!b) return { reply: T.invalidChoice(), step, session: s };
        const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id }, select: { providerServiceId: true } });
        const dates = await nextAvailableDates(row.providerServiceId, 6, channel.maxAdvanceDays);
        return {
          reply: T.dateList(dates, "new time"),
          step: dates.length ? "RESCHEDULE_DATE" : "MENU",
          session: { bookingId: b.id, serviceId: row.providerServiceId, dates, bookings: [b] },
        };
      }
      case "RESCHEDULE_DATE": {
        const date = pick(text, s.dates);
        if (!date || !s.serviceId) return { reply: T.invalidChoice(), step, session: s };
        const slots = await offerTimes(date, s.serviceId, s.bookingId);
        return { reply: T.timeList(slots, date), step: slots.length ? "RESCHEDULE_TIME" : "MENU", session: { ...s, date, slots } };
      }
      case "RESCHEDULE_TIME": {
        const slot = pick(text, s.slots);
        const current = s.bookings?.[0];
        if (!slot || !current) return { reply: T.invalidChoice(), step, session: s };
        return {
          reply: T.confirmReschedule(fmtWhen(current.startsAt, tz), fmtWhen(slot.startsAt, tz)),
          step: "CONFIRM_RESCHEDULE",
          session: { ...s, startsAt: slot.startsAt },
        };
      }
      case "CONFIRM_RESCHEDULE": {
        if (no(text)) return { reply: T.keptAsIs(), step: "MENU", session: {} };
        if (!yes(text) || !s.bookingId || !s.startsAt) return { reply: T.invalidChoice(), step, session: s };
        const b = await reschedule(actor, s.bookingId, s.startsAt, ctx);
        return { reply: T.rescheduled(b.reference, fmtWhen(b.startsAt, tz), b.status === "PENDING"), step: "MENU", session: {} };
      }

      default:
        step = "IDLE";
        return menu();
    }
  } catch (err) {
    if (err instanceof AppError && ["SLOT_TAKEN", "SLOT_UNAVAILABLE"].includes(err.code) && s.serviceId && s.date) {
      // Someone else got the slot first: re-offer what's still free.
      const slots = await offerTimes(s.date, s.serviceId, s.bookingId);
      const nextStep: Step = s.bookingId ? "RESCHEDULE_TIME" : "TIME";
      return { reply: `${T.slotTaken()}\n\n${T.timeList(slots, s.date)}`, step: slots.length ? nextStep : "MENU", session: { ...s, slots } };
    }
    if (err instanceof AppError && err.status < 500) {
      // Business-rule refusals carry user-safe messages.
      return { reply: `${err.publicMessage}\n\nReply *MENU* to start again.`, step: "MENU", session: {} };
    }
    throw err;
  }
}
