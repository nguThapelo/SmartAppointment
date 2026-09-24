import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/server/env";
import { log } from "@/server/log";

// Meta WhatsApp Cloud API: webhook signature check, payload parsing, and a
// small send client. Replaces the old Twilio integration (audit C-4, H-5).

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header.slice(7), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyToken(provided: string | null): boolean {
  const expected = env().WHATSAPP_VERIFY_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Only the fields we use; everything else in Meta's payload is ignored.
const messageSchema = z.object({
  from: z.string().regex(/^\d{8,15}$/),
  id: z.string().min(1).max(200),
  timestamp: z.string().optional(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
});

export const webhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }),
            contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() })).optional(),
            messages: z.array(messageSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

export interface InboundMessage {
  phoneNumberId: string;
  wamid: string;
  from: string; // E.164 with leading "+"
  profileName: string | null;
  text: string | null; // null for unsupported types (images, voice, …)
  timestamp: Date | null;
}

export const MAX_INBOUND_CHARS = 500;

/** Flatten a (validated) webhook payload into the inbound messages we handle. */
export function extractMessages(payload: z.infer<typeof webhookPayloadSchema>): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const v = change.value;
      for (const m of v.messages ?? []) {
        const contact = v.contacts?.find((c) => c.wa_id === m.from);
        const text =
          m.type === "text"
            ? (m.text?.body ?? "")
            : m.type === "interactive"
              ? (m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? "")
              : null;
        out.push({
          phoneNumberId: v.metadata.phone_number_id,
          wamid: m.id,
          from: `+${m.from}`,
          profileName: contact?.profile?.name?.slice(0, 80) ?? null,
          text: text === null ? null : text.replace(/\0/g, "").slice(0, MAX_INBOUND_CHARS),
          timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000) : null,
        });
      }
    }
  }
  return out;
}

// ── Sending ─────────────────────────────────────────────────────────────────

export interface MessagingGateway {
  sendText(phoneNumberId: string, to: string, body: string): Promise<{ id: string | null }>;
}

const realGateway: MessagingGateway = {
  async sendText(phoneNumberId, to, body) {
    const token = env().WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      log.warn("whatsapp send skipped: not configured");
      return { id: null };
    }
    const res = await fetch(`https://graph.facebook.com/${env().WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "text",
        text: { body: body.slice(0, 4096), preview_url: false },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.error("whatsapp send failed", { status: res.status });
      log.metric("whatsapp.send_failed", { status: res.status });
      return { id: null };
    }
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[] };
    return { id: data.messages?.[0]?.id ?? null };
  },
};

let gateway: MessagingGateway = realGateway;
export const messagingGateway = () => gateway;
export function setMessagingGatewayForTests(fake?: MessagingGateway) {
  gateway = fake ?? realGateway;
}
