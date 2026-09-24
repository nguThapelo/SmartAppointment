import { z } from "zod";
import { email, freeText, id, pagination, personName, phone } from "./common";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// ── Catalog ─────────────────────────────────────────────────────────────────
export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: freeText(500).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export const subServiceCreateSchema = z
  .object({
    categoryId: id,
    name: z.string().trim().min(2).max(80),
    description: freeText(500).optional(),
    defaultDuration: z.number().int().min(5).max(720).optional(),
  })
  .strict();

export const subServiceUpdateSchema = subServiceCreateSchema
  .omit({ categoryId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export const searchSchema = z.object({ q: z.string().trim().max(100).default("") }).strict();

// ── Provider pricing ────────────────────────────────────────────────────────
// No providerId: a provider can only ever set their OWN prices. Admins use the
// admin route, which takes providerId in the URL and is role-gated.
export const providerServiceUpsertSchema = z
  .object({
    subServiceId: id,
    pricingType: z.enum(["FIXED", "HOURLY"]),
    rateCents: z.number().int().min(0).max(10_000_000),
    durationMin: z.number().int().min(5).max(720),
    paymentMode: z.enum(["ONLINE", "ON_SITE"]).default("ONLINE"),
    isActive: z.boolean().default(true),
  })
  .strict();

// ── Availability ────────────────────────────────────────────────────────────
export const availabilityRulesSchema = z
  .object({
    rules: z
      .array(
        z
          .object({
            dayOfWeek: z.number().int().min(0).max(6),
            isOpen: z.boolean(),
            opensAt: hhmm,
            closesAt: hhmm,
          })
          .strict()
          .refine((r) => !r.isOpen || r.opensAt < r.closesAt, "Opening time must be before closing time"),
      )
      .min(1)
      .max(7)
      .refine((rs) => new Set(rs.map((r) => r.dayOfWeek)).size === rs.length, "Each day may appear once"),
  })
  .strict();

export const overrideCreateSchema = z
  .object({
    date: isoDate,
    isClosed: z.boolean(),
    opensAt: hhmm.optional(),
    closesAt: hhmm.optional(),
    reason: freeText(200).optional(),
  })
  .strict()
  .refine((o) => o.isClosed || (o.opensAt && o.closesAt && o.opensAt < o.closesAt), "Give valid opening hours or mark the day closed");

export const slotsQuerySchema = z.object({ providerServiceId: id, date: isoDate }).strict();

// ── Bookings ────────────────────────────────────────────────────────────────
// Deliberately absent: status, priceCents, clientId (clients), providerId,
// currency. Those are derived server-side (audit C-3, H-2, H-3).
export const bookingCreateSchema = z
  .object({
    providerServiceId: id,
    startsAt: z.string().datetime({ offset: true }),
    notes: freeText(1000).optional(),
    /** Admin-only: book on behalf of an existing client. Rejected for everyone else. */
    onBehalfOfClientId: id.optional(),
  })
  .strict();

export const bookingListSchema = pagination
  .extend({
    status: z
      .enum(["PENDING", "APPROVED", "DECLINED", "PAYMENT_PENDING", "PAID", "PAYMENT_FAILED", "COMPLETED", "NO_SHOW", "CANCELLED", "CLOSED"])
      .optional(),
    scope: z.enum(["upcoming", "past", "all"]).default("all"),
  })
  .strict();

export const bookingActionSchema = z.object({ reason: freeText(500).optional() }).strict();

export const rescheduleSchema = z.object({ startsAt: z.string().datetime({ offset: true }) }).strict();

// WhatsApp guests (used by the bot, never by an HTTP body directly).
export const guestDetailsSchema = z.object({
  name: personName,
  phone,
  email: email.optional(),
});

// ── Admin: users ────────────────────────────────────────────────────────────
export const adminUserCreateSchema = z
  .object({
    email,
    firstName: personName,
    lastName: personName,
    phone: phone.optional(),
    role: z.enum(["ADMIN", "PROVIDER", "CLIENT"]),
  })
  .strict();

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(["ADMIN", "PROVIDER", "CLIENT"]).optional(),
    isActive: z.boolean().optional(),
    aiEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const userListSchema = pagination
  .extend({
    role: z.enum(["ADMIN", "PROVIDER", "CLIENT"]).optional(),
    q: z.string().trim().max(100).optional(),
  })
  .strict();
