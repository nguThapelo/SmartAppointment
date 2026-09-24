import { env } from "@/server/env";
import { badRequest, unauthorized } from "@/server/errors";
import { extractMessages, verifyMetaSignature, verifyToken, webhookPayloadSchema } from "@/server/whatsapp/meta";
import { handleInbound } from "@/server/whatsapp/service";
import { publicRoute } from "@/server/withApi";

// Meta WhatsApp Cloud API webhook. Authenticated by X-Hub-Signature-256
// (HMAC of the raw body with the app secret) — ALWAYS checked, unless
// WHATSAPP_INSECURE_DEV=true, which env.ts refuses in production (audit H-5).
// There is deliberately no unauthenticated "send" endpoint (audit C-4).

const MAX_BYTES = 256 * 1024;

// Subscription handshake: echo hub.challenge only for our verify token.
export const GET = publicRoute({ skipOriginCheck: true }, async (ctx) => {
  const p = ctx.req.nextUrl.searchParams;
  if (p.get("hub.mode") !== "subscribe" || !verifyToken(p.get("hub.verify_token"))) {
    throw unauthorized("UNAUTHORISED", "Verification failed");
  }
  return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
});

export const POST = publicRoute({ skipOriginCheck: true }, async (ctx) => {
  const raw = await ctx.req.text();
  if (Buffer.byteLength(raw) > MAX_BYTES) throw badRequest("Payload too large");

  const e = env();
  const insecure = e.WHATSAPP_INSECURE_DEV && e.NODE_ENV !== "production";
  if (!insecure) {
    if (!e.WHATSAPP_APP_SECRET || !verifyMetaSignature(raw, ctx.req.headers.get("x-hub-signature-256"), e.WHATSAPP_APP_SECRET)) {
      ctx.log.metric("whatsapp.signature_invalid");
      throw unauthorized("UNAUTHORISED", "Invalid signature");
    }
  }

  let payload;
  try {
    payload = webhookPayloadSchema.parse(JSON.parse(raw));
  } catch {
    // Status updates and other event kinds we don't model: acknowledge and move on.
    return Response.json({ received: true, handled: 0 });
  }

  const results = [];
  for (const msg of extractMessages(payload)) {
    results.push(await handleInbound(msg, { requestId: ctx.requestId }));
  }
  return Response.json({ received: true, handled: results.length, results });
});
