import { prisma } from "@/lib/db";
import type { Actor } from "@/server/auth/currentUser";
import { forbidden, notFound } from "@/server/errors";

// A user's own assistant history. Only the owner can read or delete it.

export async function listConversations(user: Actor) {
  const rows = await prisma.agentConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true },
  });
  return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
}

export async function getConversation(user: Actor, id: string) {
  const c = await prisma.agentConversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      actions: { where: { status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) throw notFound("Conversation");
  return {
    id: c.id,
    title: c.title,
    messages: c.messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })),
    pendingActions: c.actions.map((a) => ({ id: a.id, tool: a.tool, summary: a.summary, expiresAt: a.expiresAt.toISOString() })),
  };
}

export async function deleteConversation(user: Actor, id: string) {
  const res = await prisma.agentConversation.deleteMany({ where: { id, userId: user.id } });
  if (res.count !== 1) throw notFound("Conversation");
}

/** Admin view of assistant activity: metadata only — never message content. */
export async function recentToolCalls(user: Actor, limit = 100) {
  if (user.role !== "ADMIN") throw forbidden();
  const rows = await prisma.agentToolCall.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 200) });
  return rows.map((r) => ({
    at: r.createdAt.toISOString(), tool: r.tool, kind: r.kind, outcome: r.outcome,
    durationMs: r.durationMs, errorCategory: r.errorCategory, userId: r.userId,
  }));
}
