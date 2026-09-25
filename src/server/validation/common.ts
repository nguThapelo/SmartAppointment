import { z } from "zod";

// Shared zod building blocks. Object schemas at API boundaries are `.strict()`
// so unexpected keys (e.g. `role`, `status`, `clientId`) are REJECTED rather
// than silently dropped — a client trying mass assignment gets a 422 and the
// attempt is visible in logs (audit C-2, C-3).

export const id = z.string().trim().min(1).max(40).regex(/^[a-z0-9]+$/i, "Invalid id");

/** A booking's internal id or its human reference (AH-XXXXXX; older SA- references still resolve). */
export const bookingKey = z
  .string()
  .trim()
  .regex(/^([A-Z]{2}-[0-9A-Z]{6}|[a-z0-9]{20,40})$/i, "Invalid booking reference");

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const password = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long");

export const personName = z.string().trim().min(1).max(80);

// E.164-ish: optional +, 8–15 digits. Spaces and dashes are stripped first.
export const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number"));

export const freeText = (max: number) => z.string().trim().max(max);

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
