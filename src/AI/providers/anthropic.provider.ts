import { MODELS } from "../config";
import type { ModelProvider, ModelRequest, ModelResponse, ModelTurn } from "./types";

// Anthropic Claude — optional second provider, only used when
// ANTHROPIC_API_KEY is set. Calls the Messages API over fetch (no extra
// dependency for an optional path).

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

function toMessages(turns: ModelTurn[]) {
  return turns.map((t) => {
    switch (t.role) {
      case "user":
        return { role: "user", content: t.text };
      case "assistant":
        return { role: "assistant", content: t.text };
      case "tool_calls":
        return {
          role: "assistant",
          content: [
            ...(t.text ? [{ type: "text", text: t.text } as Block] : []),
            ...t.calls.map((c): Block => ({ type: "tool_use", id: c.id, name: c.name, input: c.args })),
          ],
        };
      case "tool_results":
        return {
          role: "user",
          content: t.results.map((r): Block => ({ type: "tool_result", tool_use_id: r.id, content: JSON.stringify(r.result) })),
        };
    }
  });
}

export const anthropicProvider: ModelProvider = {
  name: "anthropic",
  async generate(req: ModelRequest): Promise<ModelResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELS.anthropic,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: toMessages(req.turns),
        ...(req.tools.length
          ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
          : {}),
      }),
      signal: req.signal,
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);

    const data = (await res.json()) as { content: Block[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const calls = data.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
    return {
      text: data.content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text").map((b) => b.text).join(""),
      toolCalls: calls.map((c) => ({ id: c.id, name: c.name, args: c.input ?? {} })),
      usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
    };
  },
};
