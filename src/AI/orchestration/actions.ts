import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { userActor } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import type { Actor } from "@/server/auth/currentUser";
import { AppError, conflict, notFound } from "@/server/errors";
import { log } from "@/server/log";
import { TOOLS } from "../tools/catalog";

// Confirmation protocol for write tools (design §6.4).
//
// A pending action runs only when the SAME user who asked for it presses
// Confirm, before it expires, exactly once. The claim is a single atomic
// UPDATE (owner + PENDING + not expired), which gives ownership, single use
// and replay protection together. Execution then re-runs the real service
// call, so permissions and booking state are checked again at that moment.

export type ActionResult =
  | { status: "EXECUTED"; summary: string; result: unknown }
  | { status: "FAILED"; summary: string; message: string };

async function explainUnclaimable(user: Actor, actionId: string): Promise<never> {
  const a = await prisma.agentPendingAction.findFirst({ where: { id: actionId, userId: user.id } });
  if (!a) throw notFound("Action");
  if (a.status === "PENDING") throw conflict("ACTION_EXPIRED", "This action expired. Ask the assistant again.");
  throw conflict("ACTION_ALREADY_RESOLVED", `This action was already ${a.status.toLowerCase()}.`);
}

export async function confirmAction(user: Actor, actionId: string, requestId?: string): Promise<ActionResult> {
  const claimed = await prisma.agentPendingAction.updateMany({
    where: { id: actionId, userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: "EXECUTED", resolvedAt: new Date() },
  });
  if (claimed.count !== 1) return explainUnclaimable(user, actionId);

  const action = await prisma.agentPendingAction.findUniqueOrThrow({ where: { id: actionId } });
  const def = TOOLS[action.tool];
  const ctx = { requestId, viaAgent: true };

  try {
    if (!def?.execute || def.kind !== "write" || !def.roles.includes(user.role)) {
      throw new AppError(403, "FORBIDDEN", "That action isn't available to you");
    }
    const args = def.input.parse(action.argsJson);
    const result = await def.execute(userActor(user), args, ctx, user);
    await prisma.agentPendingAction.update({ where: { id: action.id }, data: { resultJson: result as Prisma.InputJsonValue } });
    await note(action.conversationId, `✅ Done: ${action.summary}`);
    await recordAudit(prisma, {
      actorType: "AGENT", actorId: user.id, actorRole: user.role, action: `agent.confirm.${action.tool}`,
      entityType: "AgentPendingAction", entityId: action.id, outcome: "success", requestId,
    });
    return { status: "EXECUTED", summary: action.summary, result };
  } catch (err) {
    if (!(err instanceof AppError) || err.status >= 500) log.error("agent action failed", { err, tool: action.tool, requestId });
    const message = err instanceof AppError && err.status < 500 ? err.publicMessage : "That didn't work because of a problem on our side.";
    await prisma.agentPendingAction.update({
      where: { id: action.id },
      data: { status: "FAILED", resultJson: { error: err instanceof AppError ? err.code : "INTERNAL" } },
    });
    await note(action.conversationId, `❌ Couldn't complete: ${action.summary} — ${message}`);
    await recordAudit(prisma, {
      actorType: "AGENT", actorId: user.id, actorRole: user.role, action: `agent.confirm.${action.tool}`,
      entityType: "AgentPendingAction", entityId: action.id, outcome: "failed", requestId,
      detail: { code: err instanceof AppError ? err.code : "INTERNAL" },
    });
    return { status: "FAILED", summary: action.summary, message };
  }
}

export async function cancelAction(user: Actor, actionId: string) {
  const res = await prisma.agentPendingAction.updateMany({
    where: { id: actionId, userId: user.id, status: "PENDING" },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
  if (res.count !== 1) return explainUnclaimable(user, actionId);
  const a = await prisma.agentPendingAction.findUniqueOrThrow({ where: { id: actionId } });
  await note(a.conversationId, `Cancelled: ${a.summary}`);
  return { status: "CANCELLED" as const };
}

/** Outcomes are written into the conversation so the model knows what really happened. */
async function note(conversationId: string, content: string) {
  await prisma.agentMessage.create({ data: { conversationId, role: "assistant", content } });
}
