import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { MODELS } from "../config";
import type { ModelProvider, ModelRequest, ModelResponse, ModelTurn } from "./types";

// Google Gemini (default provider — free tier). Function calling via
// `parametersJsonSchema`. For tool rounds the model's own content is replayed
// verbatim so Gemini 2.5's thought signatures survive between calls.

function toContents(turns: ModelTurn[]): Content[] {
  return turns.map((t): Content => {
    switch (t.role) {
      case "user":
        return { role: "user", parts: [{ text: t.text }] };
      case "assistant":
        return { role: "model", parts: [{ text: t.text }] };
      case "tool_calls":
        if (t.provider === "gemini" && t.raw) return t.raw as Content;
        return {
          role: "model",
          parts: [
            ...(t.text ? [{ text: t.text } as Part] : []),
            ...t.calls.map((c): Part => ({ functionCall: { id: c.id, name: c.name, args: c.args } })),
          ],
        };
      case "tool_results":
        return {
          role: "user",
          parts: t.results.map((r): Part => ({ functionResponse: { id: r.id, name: r.name, response: { result: r.result } } })),
        };
    }
  });
}

let client: GoogleGenAI | undefined;

export const geminiProvider: ModelProvider = {
  name: "gemini",
  async generate(req: ModelRequest): Promise<ModelResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    client ??= new GoogleGenAI({ apiKey });

    const res = await client.models.generateContent({
      model: MODELS.gemini,
      contents: toContents(req.turns),
      config: {
        systemInstruction: req.system,
        maxOutputTokens: req.maxTokens,
        temperature: 0.2,
        abortSignal: req.signal,
        ...(req.tools.length
          ? {
              tools: [
                {
                  functionDeclarations: req.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parametersJsonSchema: t.parameters,
                  })),
                },
              ],
            }
          : {}),
      },
    });

    const calls = res.functionCalls ?? [];
    return {
      text: calls.length ? "" : (res.text ?? ""),
      toolCalls: calls.map((c, i) => ({ id: c.id ?? `call_${i}`, name: c.name ?? "", args: (c.args ?? {}) as Record<string, unknown> })),
      raw: res.candidates?.[0]?.content,
      usage: { input: res.usageMetadata?.promptTokenCount ?? 0, output: res.usageMetadata?.candidatesTokenCount ?? 0 },
    };
  },
};
