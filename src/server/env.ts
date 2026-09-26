import { z } from "zod";

// Every environment variable the server reads goes through here, so a missing or
// malformed value fails loudly at first use instead of surfacing as a confusing
// runtime error deep inside a request. Integration secrets are optional: features
// that need them check `isConfigured()` and degrade (e.g. no WhatsApp) rather
// than taking the whole app down.

const bool = z
  .enum(["true", "false", ""])
  .optional()
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(16).optional(),

  S3_BUCKET_NAME: z.string().optional(),
  // The bucket's region. Amplify reserves the AWS_* prefix, so production sets
  // S3_REGION; AWS_REGION remains the local-dev / Lambda-runtime fallback.
  S3_REGION: z.string().optional(),
  AWS_REGION: z.string().default("eu-central-1"),

  STRIPE_SECRET_KEY: z
    .string()
    .refine((v) => v.startsWith("sk_test_"), "Only Stripe TEST keys are allowed")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default("v21.0"),
  WHATSAPP_INSECURE_DEV: bool,

  AI_ENABLED: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v !== "false"),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_ACTIVE_PROVIDER: z.enum(["gemini", "anthropic", ""]).optional(),
  AI_DAILY_USER_LIMIT: z.coerce.number().int().positive().default(30),
  AI_DAILY_GLOBAL_LIMIT: z.coerce.number().int().positive().default(400),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default("primary"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // Treat empty strings from .env files as "unset".
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n  ${issues.join("\n  ")}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.WHATSAPP_INSECURE_DEV) {
    throw new Error("WHATSAPP_INSECURE_DEV must not be enabled in production");
  }
  cached = parsed.data;
  return cached;
}

/** Test hook: forget the cached parse so tests can change process.env. */
export function resetEnvCache() {
  cached = undefined;
}

export const isConfigured = {
  stripe: () => Boolean(env().STRIPE_SECRET_KEY && env().STRIPE_WEBHOOK_SECRET),
  whatsapp: () =>
    Boolean(env().WHATSAPP_ACCESS_TOKEN && (env().WHATSAPP_APP_SECRET || env().WHATSAPP_INSECURE_DEV)),
  s3: () => Boolean(env().S3_BUCKET_NAME),
  smtp: () => Boolean(env().SMTP_HOST && env().SMTP_USER && env().SMTP_PASS),
  calendar: () =>
    Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET && env().GOOGLE_REFRESH_TOKEN),
};
