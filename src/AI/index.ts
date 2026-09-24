/**
 * AI/index.ts — the ONLY import surface for the assistant (ReportReviewAssist
 * pattern). Route handlers own authentication, rate limiting and the response
 * envelope; nothing in /AI touches Request/Response or cookies. See AI/README.md.
 */
export { runAgentTurn, type TurnResult } from "./orchestration/turn";
export { confirmAction, cancelAction, type ActionResult } from "./orchestration/actions";
export { listConversations, getConversation, deleteConversation, recentToolCalls } from "./orchestration/conversations";
export { setModelProvidersForTests } from "./providers/registry";
export type { ModelProvider, ModelRequest, ModelResponse } from "./providers/types";
