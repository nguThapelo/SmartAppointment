import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, isAdmin, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { forbidden, notFound, unprocessable } from "@/server/errors";
import { log } from "@/server/log";
import { hit, RATE_LIMITS } from "@/server/security/rateLimit";
import { runFlow, type Step } from "./flow";
import { messagingGateway, type InboundMessage } from "./meta";
import { T } from "./templates";

// Orchestrates inbound WhatsApp messages and the dashboard views of them.

const SERVICE_WINDOW_MS = 24 * 3600_000;

/** Process one verified inbound message. Never throws — the webhook must always 200. */
export async function handleInbound(msg: InboundMessage, ctx: ServiceCtx = {}): Promise<"processed" | "duplicate" | "ignored"> {
  const wlog = log.child({ requestId: ctx.requestId, wamid: msg.wamid });

  // 1) Dedupe: Meta retries deliveries; the unique wamid makes this idempotent.
  try {
    await prisma.webhookEvent.create({
      data: { provider: "whatsapp", externalId: msg.wamid, signatureOk: true, type: "message" },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return "duplicate";
    throw err;
  }

  const channel = await prisma.whatsAppChannel.findUnique({
    where: { phoneNumberId: msg.phoneNumberId },
    include: { provider: { select: { timezone: true, isActive: true } } },
  });
  if (!channel) {
    wlog.warn("whatsapp message for unknown channel");
    return "ignored";
  }

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { channelId_customerPhone: { channelId: channel.id, customerPhone: msg.from } },
    create: { channelId: channel.id, customerPhone: msg.from, customerName: msg.profileName, lastInboundAt: new Date() },
    update: { lastInboundAt: new Date(), ...(msg.profileName ? { customerName: msg.profileName } : {}) },
  });
  await prisma.whatsAppMessage.create({
    data: { conversationId: conversation.id, direction: "INBOUND", body: msg.text ?? "[unsupported message type]", wamid: msg.wamid },
  });

  let reply: string;
  let step = conversation.step as Step;
  let session: Prisma.InputJsonValue = conversation.session as Prisma.InputJsonValue;

  if (!channel.isActive || !channel.provider.isActive) {
    reply = T.unavailable();
  } else if (!(await hit(`whatsapp:${channel.id}:${msg.from}`, RATE_LIMITS.whatsappSender)).allowed) {
    wlog.metric("ratelimit.hit", { scope: "whatsapp" });
    reply = T.tooFast();
  } else if (msg.text === null) {
    reply = T.unsupported();
  } else {
    try {
      const result = await runFlow(
        { channel, phone: msg.from, profileName: msg.profileName, step: conversation.step, session: conversation.session, text: msg.text },
        ctx,
      );
      reply = result.reply;
      step = result.step;
      session = result.session;
    } catch (err) {
      wlog.error("whatsapp flow error", { err });
      wlog.metric("error.unhandled", { scope: "whatsapp" });
      reply = T.error();
      step = "MENU";
      session = {};
    }
  }

  await prisma.whatsAppConversation.update({ where: { id: conversation.id }, data: { step, session } });
  await sendAndLog(channel.phoneNumberId, conversation.id, msg.from, reply);
  await prisma.webhookEvent.update({
    where: { provider_externalId: { provider: "whatsapp", externalId: msg.wamid } },
    data: { processedAt: new Date() },
  });
  return "processed";
}

async function sendAndLog(phoneNumberId: string, conversationId: string, to: string, body: string) {
  const sent = await messagingGateway().sendText(phoneNumberId, to, body).catch((err) => {
    log.error("whatsapp send threw", { err });
    return { id: null };
  });
  await prisma.whatsAppMessage.create({
    data: { conversationId, direction: "OUTBOUND", body, wamid: sent.id },
  });
}

/**
 * Proactive message to a WhatsApp guest about their booking — only inside the
 * free 24h customer-service window (outside it, Meta requires paid templates;
 * the caller falls back to email). Returns whether it was sent.
 */
export async function notifyGuest(bookingId: string, text: string): Promise<boolean> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { whatsappChannel: true },
  });
  if (!b?.whatsappChannel || !b.customerPhone) return false;
  const conv = await prisma.whatsAppConversation.findUnique({
    where: { channelId_customerPhone: { channelId: b.whatsappChannel.id, customerPhone: b.customerPhone } },
  });
  if (!conv?.lastInboundAt || Date.now() - conv.lastInboundAt.getTime() > SERVICE_WINDOW_MS) return false;
  await sendAndLog(b.whatsappChannel.phoneNumberId, conv.id, b.customerPhone, text);
  return true;
}

// ── Dashboard: channels, conversations, replies ─────────────────────────────

export const channelCreateSchema = z
  .object({
    providerId: z.string().min(1).max(40),
    phoneNumberId: z.string().regex(/^\d{5,30}$/, "Meta phone number id is numeric"),
    displayNumber: z.string().trim().min(8).max(20),
    name: z.string().trim().min(2).max(80),
    welcomeMessage: z.string().trim().min(2).max(500),
    maxAdvanceDays: z.number().int().min(1).max(60).default(30),
    autoApprove: z.boolean().default(true),
  })
  .strict();
export const channelUpdateSchema = channelCreateSchema
  .omit({ providerId: true, phoneNumberId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();
export const replySchema = z.object({ body: z.string().trim().min(1).max(1000) }).strict();

function channelScope(actor: ServiceActor): Prisma.WhatsAppChannelWhereInput {
  if (actor.kind !== "user") throw forbidden();
  if (actor.user.role === "ADMIN") return {};
  if (actor.user.role === "PROVIDER") return { providerId: actor.user.id };
  throw forbidden();
}

export async function listChannels(actor: ServiceActor) {
  const rows = await prisma.whatsAppChannel.findMany({
    where: channelScope(actor),
    include: { provider: { select: { firstName: true, lastName: true } }, _count: { select: { bookings: true, conversations: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((c) => ({
    id: c.id, name: c.name, displayNumber: c.displayNumber, phoneNumberId: c.phoneNumberId,
    provider: `${c.provider.firstName} ${c.provider.lastName}`, welcomeMessage: c.welcomeMessage,
    maxAdvanceDays: c.maxAdvanceDays, autoApprove: c.autoApprove, isActive: c.isActive,
    bookings: c._count.bookings, conversations: c._count.conversations,
  }));
}

export async function createChannel(actor: ServiceActor, input: z.infer<typeof channelCreateSchema>, ctx: ServiceCtx = {}) {
  if (!isAdmin(actor)) throw forbidden();
  const provider = await prisma.user.findFirst({ where: { id: input.providerId, role: "PROVIDER", deletedAt: null } });
  if (!provider) throw unprocessable("PROVIDER_NOT_FOUND", "Choose an existing provider");
  const row = await prisma.whatsAppChannel.create({ data: input });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "whatsapp.channel_create", entityType: "WhatsAppChannel",
    entityId: row.id, outcome: "success", requestId: ctx.requestId,
  });
  return row;
}

export async function updateChannel(actor: ServiceActor, id: string, input: z.infer<typeof channelUpdateSchema>, ctx: ServiceCtx = {}) {
  if (!isAdmin(actor)) throw forbidden();
  const row = await prisma.whatsAppChannel.update({ where: { id }, data: input });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "whatsapp.channel_update", entityType: "WhatsAppChannel",
    entityId: id, outcome: "success", requestId: ctx.requestId, detail: { fields: Object.keys(input) },
  });
  return row;
}

export async function listConversations(actor: ServiceActor) {
  const rows = await prisma.whatsAppConversation.findMany({
    where: { channel: channelScope(actor) },
    include: {
      channel: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map((c) => ({
    id: c.id,
    channel: c.channel.name,
    customerName: c.customerName,
    customerPhone: c.customerPhone,
    lastMessage: c.messages[0]?.body.slice(0, 120) ?? null,
    lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
    canReply: !!c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < SERVICE_WINDOW_MS,
  }));
}

async function visibleConversation(actor: ServiceActor, id: string) {
  const c = await prisma.whatsAppConversation.findFirst({ where: { id, channel: channelScope(actor) }, include: { channel: true } });
  if (!c) throw notFound("Conversation");
  return c;
}

export async function conversationMessages(actor: ServiceActor, id: string) {
  const c = await visibleConversation(actor, id);
  const msgs = await prisma.whatsAppMessage.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: "asc" }, take: 300 });
  return msgs.map((m) => ({ id: m.id, direction: m.direction, body: m.body, createdAt: m.createdAt.toISOString() }));
}

/** Staff reply from the dashboard. Only inside the 24h window (free + allowed by Meta). */
export async function replyToConversation(actor: ServiceActor, id: string, body: string, ctx: ServiceCtx = {}) {
  const c = await visibleConversation(actor, id);
  if (!c.lastInboundAt || Date.now() - c.lastInboundAt.getTime() > SERVICE_WINDOW_MS) {
    throw unprocessable("OUTSIDE_WINDOW", "You can only reply within 24 hours of the customer's last message");
  }
  await sendAndLog(c.channel.phoneNumberId, c.id, c.customerPhone, body);
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "whatsapp.reply", entityType: "WhatsAppConversation",
    entityId: c.id, outcome: "success", requestId: ctx.requestId,
  });
  return { ok: true };
}
