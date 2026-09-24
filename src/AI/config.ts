import { env } from "@/server/env";

// Limits for the assistant (design §6.6). Everything here keeps usage inside
// the Gemini free tier and inside Amplify's SSR request timeout.

export const AI_LIMITS = {
  maxUserMessageChars: 1500,
  historyTurns: 12,
  maxToolRounds: 4,
  maxToolCallsPerRound: 5,
  maxPendingActionsPerTurn: 3,
  maxOutputTokens: 1024,
  turnTimeoutMs: 20_000,
  pendingActionTtlMs: 10 * 60_000,
} as const;

export const aiEnabled = () => env().AI_ENABLED;
export const dailyUserLimit = () => env().AI_DAILY_USER_LIMIT;
export const dailyGlobalLimit = () => env().AI_DAILY_GLOBAL_LIMIT;

export const MODELS = {
  gemini: process.env.AI_GEMINI_MODEL || "gemini-2.5-flash",
  anthropic: process.env.AI_ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
};
