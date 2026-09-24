import { z } from "zod";
import { email, password, personName, phone } from "./common";

// Note: there is intentionally no `role` field anywhere here. Registration
// always creates a CLIENT; a `role` key in the body fails `.strict()` (audit C-2).

export const registerSchema = z
  .object({
    email,
    password,
    firstName: personName,
    lastName: personName,
    phone: phone.optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
  })
  .strict();
