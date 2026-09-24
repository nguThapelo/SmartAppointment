// Provider-neutral shapes for one model call. Each provider adapter converts
// these to its own wire format, so orchestration never depends on a vendor SDK.

export type JsonSchema = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ModelTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  /** A model turn that requested tools. `raw` is the provider's own content, replayed verbatim (e.g. Gemini thought signatures). */
  | { role: "tool_calls"; calls: ToolCall[]; text?: string; raw?: unknown; provider: string }
  | { role: "tool_results"; results: { id: string; name: string; result: unknown }[] };

export interface ModelRequest {
  system: string;
  turns: ModelTurn[];
  tools: ToolSpec[];
  maxTokens: number;
  signal: AbortSignal;
}

export interface ModelResponse {
  text: string;
  toolCalls: ToolCall[];
  raw?: unknown;
  usage: { input: number; output: number };
}

export interface ModelProvider {
  name: string;
  generate(req: ModelRequest): Promise<ModelResponse>;
}
