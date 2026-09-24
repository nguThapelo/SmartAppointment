import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { userActor } from "@/server/actors";
import type { Actor } from "@/server/auth/currentUser";
import { AppError } from "@/server/errors";
import { log } from "@/server/log";
import { AI_LIMITS } from "../config";
import { TOOLS } from "./catalog";

// The ONLY path from a model's tool call to application code (design §6.2).
//
// For every call: the tool must exist AND be allowed for the user's role
// (checked here, not just by what was offered to the model); arguments are
// validated strictly; the actor is the session user, never model input.
// Read tools run. Write tools only produce a pending action for the user to
// confirm. Every call is logged as metadata (no arguments, no content).

export interface ExecContext {
  user: Actor;
  conversationId: string;
  requestId?: string;
  /** Pending actions created so far in this turn (capped). */
  pending: { id: string; tool: string; summary: string; expiresAt: string }[];
}

export type ToolOutcome = "ok" | "denied" | "invalid" | "error" | "pending_confirmation";

export async function executeTool(name: string, rawArgs: unknown, ctx: ExecContext): Promise<unknown> {
  const started = Date.now();
  const def = TOOLS[name];
  let outcome: ToolOutcome = "ok";
  let errorCategory: string | undefined;

  const finish = async (result: unknown) => {
    await prisma.agentToolCall.create({
      data: {
        conversationId: ctx.conversationId, userId: ctx.user.id, tool: def ? name : "unknown",
        kind: def?.kind ?? "read", outcome, durationMs: Date.now() - started, errorCategory,
      },
    });
    if (outcome === "denied") log.metric("ai.tool_denied", { tool: name, role: ctx.user.role, requestId: ctx.requestId });
    return result;
  };

  if (!def || !def.roles.includes(ctx.user.role)) {
    outcome = "denied";
    errorCategory = def ? "role" : "unknown_tool";
    return finish({ error: "That action isn't available to you." });
  }

  const parsed = def.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    outcome = "invalid";
    errorCategory = "arguments";
    return finish({
      error: "Invalid arguments",
      issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    });
  }

  const actor = userActor(ctx.user);
  try {
    if (def.kind === "read") {
      return finish(await def.read!(actor, parsed.data, ctx.user));
    }

    if (ctx.pending.length >= AI_LIMITS.maxPendingActionsPerTurn) {
      outcome = "denied";
      errorCategory = "too_many_actions";
      return finish({ error: "Too many actions at once. Ask the user to confirm the pending ones first." });
    }
    // Same permission/ownership/state checks as the real action — no changes.
    const summary = await def.preview!(actor, parsed.data, ctx.user);
    const action = await prisma.agentPendingAction.create({
      data: {
        conversationId: ctx.conversationId, userId: ctx.user.id, tool: name, argsJson: parsed.data as Prisma.InputJsonValue,
        summary, expiresAt: new Date(Date.now() + AI_LIMITS.pendingActionTtlMs),
      },
    });
    ctx.pending.push({ id: action.id, tool: name, summary, expiresAt: action.expiresAt.toISOString() });
    outcome = "pending_confirmation";
    return finish({
      status: "PENDING_CONFIRMATION",
      summary,
      note: "Nothing has happened yet. Ask the user to review and press Confirm.",
    });
  } catch (err) {
    if (err instanceof AppError && err.status < 500) {
      outcome = err.status === 403 || err.status === 404 ? "denied" : "error";
      errorCategory = err.code;
      return finish({ error: err.publicMessage });
    }
    outcome = "error";
    errorCategory = "internal";
    log.error("agent tool failed", { tool: name, err, requestId: ctx.requestId });
    return finish({ error: "That didn't work because of a problem on our side." });
  }
}
