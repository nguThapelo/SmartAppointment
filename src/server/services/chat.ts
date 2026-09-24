import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ServiceActor } from "@/server/actors";
import { forbidden, unprocessable } from "@/server/errors";
import { loadVisible } from "@/server/services/booking";

// Per-booking messages between client and provider. Replaces the old
// socket.io chat: Amplify has no websockets, so the UI polls with `after`.
// Messages are stored and rendered as plain text only.

export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
export const messagesQuerySchema = z.object({ after: z.string().datetime().optional() }).strict();

const CLOSED_FOR_CHAT = ["DECLINED", "CANCELLED", "CLOSED", "NO_SHOW"];

export async function listMessages(actor: ServiceActor, bookingKey: string, after?: string) {
  const { booking, party } = await loadVisible(actor, bookingKey);
  if (party === "guest") throw forbidden(); // WhatsApp guests talk through WhatsApp
  const rows = await prisma.bookingMessage.findMany({
    where: { bookingId: booking.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    include: { sender: { select: { id: true, firstName: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    sender: { name: m.sender.firstName, role: m.sender.role },
    mine: actor.kind === "user" && m.senderId === actor.user.id,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function postMessage(actor: ServiceActor, bookingKey: string, body: string) {
  const { booking, party } = await loadVisible(actor, bookingKey);
  // Admins can read for support/moderation but don't join the conversation.
  if (actor.kind !== "user" || (party !== "client" && party !== "provider")) throw forbidden();
  if (CLOSED_FOR_CHAT.includes(booking.status)) {
    throw unprocessable("CHAT_CLOSED", "Messaging is closed for this booking");
  }
  const m = await prisma.bookingMessage.create({ data: { bookingId: booking.id, senderId: actor.user.id, body } });
  return { id: m.id, createdAt: m.createdAt.toISOString() };
}
