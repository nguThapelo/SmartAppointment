import { env } from "@/server/env";
import { anthropicProvider } from "./anthropic.provider";
import { geminiProvider } from "./gemini.provider";
import { ruleBasedProvider } from "./ruleBased.provider";
import type { ModelProvider } from "./types";

// Fallback chain (ReportReviewAssist pattern): configured cloud providers in
// order, then the rule-based fallback. AI_ACTIVE_PROVIDER pins one provider.

let override: ModelProvider[] | undefined;

export function providerChain(): ModelProvider[] {
  if (override) return override;
  const e = env();
  const configured: Record<string, ModelProvider | undefined> = {
    gemini: e.GEMINI_API_KEY ? geminiProvider : undefined,
    anthropic: e.ANTHROPIC_API_KEY ? anthropicProvider : undefined,
  };
  const order = e.AI_ACTIVE_PROVIDER ? [e.AI_ACTIVE_PROVIDER] : ["gemini", "anthropic"];
  const chain = order.map((k) => configured[k]).filter((p): p is ModelProvider => Boolean(p));
  return [...chain, ruleBasedProvider];
}

/** Test hook: use these providers instead (pass nothing to restore). */
export function setModelProvidersForTests(providers?: ModelProvider[]) {
  override = providers;
}
