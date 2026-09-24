# /AI — SmartAppointment assistant

Everything the assistant needs — model providers, prompts, tools, guardrails and
the turn loop — lives in this folder, following the structure of the
ReportReviewAssist `/AI` module. It is an **in-process module**: the route
handlers under `src/app/api/ai/*` import `AI/index.ts` and call plain functions.

## Boundary

- **Nothing in `/AI` touches `Request`/`Response` or cookies.** Routes own
  authentication, rate limiting and the response envelope, then pass the
  session user (`Actor`) in.
- **Tools never touch the database for business logic.** They call the same
  services as the web UI and WhatsApp bot (`src/server/services/*`), so every
  permission, ownership, slot, price and state-machine rule applies unchanged.

## Layout

```
AI/
  index.ts                 public API — the only thing routes import
  config.ts                limits (history, rounds, timeout, TTLs) and model names
  providers/
    types.ts               provider-neutral request/response shapes
    registry.ts            fallback chain: Gemini → Anthropic (if keyed) → rules
    gemini.provider.ts     default, free tier; replays raw content for thought signatures
    anthropic.provider.ts  optional, Messages API over fetch
    ruleBased.provider.ts  last resort; no tools, can't read or change anything
  prompts/
    system.prompt.ts       role-aware system prompt (guidance, not the security boundary)
    help.ts                static help facts for getPlatformHelp
  guardrails/guards.ts     kill switches, message limits, daily request budget
  tools/
    catalog.ts             every tool: roles, kind, zod input, read / preview / execute
    jsonSchema.ts          zod → JSON Schema (one schema drives the model AND validation)
    executor.ts            the ONLY path from a model tool call to application code
  orchestration/
    turn.ts                one chat turn: budget → history → model/tool loop → persist
    actions.ts             confirm / cancel of pending write actions
    conversations.ts       a user's own history; admin tool-call activity (metadata only)
```

## Security model

| Threat | Control | Where |
|---|---|---|
| Model calls a tool the user's role can't use | Tools filtered per role when offered **and** re-checked on every call | `tools/executor.ts` |
| Model passes someone else's id / extra fields | No tool accepts user ids; zod `.strict()` rejects unknown keys; bookings by reference, resolved through ownership checks | `tools/catalog.ts`, booking service |
| Prompt injection makes the model take actions | Write tools only create a **pending action**; nothing changes until the user presses Confirm on a card showing a **server-written** summary | `executor.ts`, `orchestration/actions.ts` |
| Replayed / forged / someone else's confirmation | One atomic claim: owner + `PENDING` + not expired → single use | `orchestration/actions.ts` |
| State changed between proposal and confirmation | Execution re-runs the real service call, which re-checks permissions and state | `orchestration/actions.ts` |
| Sensitive data leaking into the model | Minimal tool DTOs: no internal ids, emails, phones, notes or feedback text; admin user lists mask emails | `tools/catalog.ts` |
| Cost / abuse | Per-user + global daily budgets, per-minute rate limit, 1 500-char messages, 4 tool rounds, 20 s turn timeout | `guardrails/guards.ts`, `config.ts` |
| Logs leaking conversations | `AgentToolCall` stores tool, outcome, duration, error category — never arguments or text | `executor.ts` |

`tests/integration/ai-agent.test.ts` drives these with a scripted model that
behaves like a compromised one (calls unoffered tools, injects user ids,
"obeys" injected instructions) and asserts the code stops it.

## Adding a tool

1. Define it in `tools/catalog.ts` with `define({...})`: roles, kind, a
   `.strict()` zod input, and either `read`, or `preview` + `execute`.
2. `preview` must perform the same checks as `execute` without side effects
   and return a one-sentence summary the user will confirm.
3. Add a test in `tests/integration/ai-agent.test.ts`.
