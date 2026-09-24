import { prisma } from "@/lib/db";
import type { Actor } from "@/server/auth/currentUser";
import { notFound } from "@/server/errors";
import { log } from "@/server/log";
import { AI_LIMITS } from "../config";
import { assertAiAllowed, recordTokens, reserveBudget, sanitizeMessage } from "../guardrails/guards";
import { buildSystemPrompt } from "../prompts/system.prompt";
import { providerChain } from "../providers/registry";
import type { ModelProvider, ModelRequest, ModelResponse, ModelTurn, ToolSpec } from "../providers/types";
import { toolsForRole } from "../tools/catalog";
import { executeTool, type ExecContext } from "../tools/executor";
import { toJsonSchema } from "../tools/jsonSchema";

export interface TurnResult {
  conversationId: string;
  reply: string;
  pendingActions: ExecContext["pending"];
  provider: string;
}

const specCache = new Map<string, ToolSpec[]>();
function specsFor(user: Actor): ToolSpec[] {
  const cached = specCache.get(user.role);
  if (cached) return cached;
  const specs = toolsForRole(user.role).map((t) => ({ name: t.name, description: t.description, parameters: toJsonSchema(t.input) }));
  specCache.set(user.role, specs);
  return specs;
}

/** Try each configured provider in turn; the rule-based fallback never fails. */
async function generate(chain: ModelProvider[], req: ModelRequest, requestId?: string) {
  let lastErr: unknown;
  for (const p of chain) {
    try {
      return { provider: p, res: await p.generate(req) };
    } catch (err) {
      lastErr = err;
      if (req.signal.aborted) break;
      log.warn("ai provider failed, trying next", { provider: p.name, err, requestId });
      log.metric("ai.provider_error", { provider: p.name });
    }
  }
  throw lastErr;
}

export async function runAgentTurn(opts: {
  user: Actor;
  message: string;
  conversationId?: string;
  requestId?: string;
}): Promise<TurnResult> {
  const { user, requestId } = opts;
  assertAiAllowed(user);
  const message = sanitizeMessage(opts.message);
  await reserveBudget(user.id);

  // Conversation must belong to this user.
  const conversation = opts.conversationId
    ? await prisma.agentConversation.findFirst({ where: { id: opts.conversationId, userId: user.id } })
    : await prisma.agentConversation.create({ data: { userId: user.id, title: message.slice(0, 60) } });
  if (!conversation) throw notFound("Conversation");

  const history = await prisma.agentMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: AI_LIMITS.historyTurns,
  });
  const turns: ModelTurn[] = history
    .reverse()
    .map((m): ModelTurn => (m.role === "user" ? { role: "user", text: m.content } : { role: "assistant", text: m.content }));
  turns.push({ role: "user", text: message });
  await prisma.agentMessage.create({ data: { conversationId: conversation.id, role: "user", content: message } });

  const exec: ExecContext = { user, conversationId: conversation.id, requestId, pending: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.turnTimeoutMs);
  const usage = { input: 0, output: 0 };
  let chain = providerChain();
  let providerName = chain[0]!.name;
  let reply = "";

  try {
    for (let round = 0; round <= AI_LIMITS.maxToolRounds; round++) {
      const lastRound = round === AI_LIMITS.maxToolRounds;
      const { provider, res } = await generate(
        chain,
        {
          system: buildSystemPrompt(user),
          turns,
          // Final round: no tools, forcing a text answer.
          tools: lastRound ? [] : specsFor(user),
          maxTokens: AI_LIMITS.maxOutputTokens,
          signal: controller.signal,
        },
        requestId,
      );
      // Stick with whichever provider answered for the rest of this turn.
      chain = chain.slice(chain.indexOf(provider));
      providerName = provider.name;
      usage.input += res.usage.input;
      usage.output += res.usage.output;

      if (!res.toolCalls.length) {
        reply = res.text.trim();
        break;
      }
      await runToolRound(res, provider.name, turns, exec);
    }
  } catch (err) {
    log.error("ai turn failed", { err, requestId });
    reply = controller.signal.aborted
      ? "Sorry, that took too long. Please try a simpler question."
      : "Sorry, the assistant ran into a problem. Please try again, or use the menus.";
  } finally {
    clearTimeout(timer);
  }

  if (!reply) reply = exec.pending.length ? "Please review and confirm the action below." : "Sorry, I couldn't work that out. Could you rephrase?";

  await prisma.agentMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: reply } });
  await prisma.agentConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  await recordTokens(user.id, usage.input, usage.output);

  return { conversationId: conversation.id, reply, pendingActions: exec.pending, provider: providerName };
}

async function runToolRound(res: ModelResponse, provider: string, turns: ModelTurn[], exec: ExecContext) {
  const calls = res.toolCalls.slice(0, AI_LIMITS.maxToolCallsPerRound);
  turns.push({ role: "tool_calls", calls, text: res.text || undefined, raw: res.raw, provider });
  const results = [];
  for (const call of calls) {
    results.push({ id: call.id, name: call.name, result: await executeTool(call.name, call.args, exec) });
  }
  turns.push({ role: "tool_results", results });
}
