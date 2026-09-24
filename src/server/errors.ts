import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

// Every expected failure is an AppError with a stable `code` and a message that
// is safe to show a user. Anything else becomes a generic 500 — internal error
// text (Prisma, Stripe, stack traces) never reaches the client (audit M-7).

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly details?: unknown,
  ) {
    super(publicMessage);
    this.name = "AppError";
  }
}

export const badRequest = (message = "Invalid request", details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (code = "UNAUTHENTICATED", message = "Please sign in") =>
  new AppError(401, code, message);
export const forbidden = (message = "You don't have permission to do that") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new AppError(429, "RATE_LIMITED", "Too many requests, please slow down", { retryAfterSeconds });
export const serviceUnavailable = (message: string) =>
  new AppError(503, "UNAVAILABLE", message);

/** Normalise anything thrown into an AppError (unknowns → generic 500). */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return unprocessable("VALIDATION_FAILED", "Some fields are invalid", err.flatten());
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return conflict("ALREADY_EXISTS", "That record already exists");
    if (err.code === "P2025") return notFound();
  }
  return new AppError(500, "INTERNAL", "Something went wrong. Please try again.");
}

/** True when Postgres rejected a write because of the booking overlap constraint. */
export function isSlotConflict(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return text.includes("booking_no_overlap") || text.includes("23P01");
}
