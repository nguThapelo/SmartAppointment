# Phase 3 — Implementation Summary

_Branch `rebuild` · 2026-09-24 · Design: [PHASE-2-DESIGN.md](design/PHASE-2-DESIGN.md) · Audit: [PHASE-1-AUDIT.md](audit/PHASE-1-AUDIT.md)_

**State:** backend complete and tested; no UI yet (Phase 4), not deployed (Phase 5).
**Checks at the last commit:** 612 tests passing against real Postgres 16 · `tsc` clean · ESLint clean · `next build` (Next.js 16) succeeds.

## Commits

| Commit | Scope |
|---|---|
| `d438fe1` | Next 16 scaffold, Prisma schema + raw-SQL constraints, auth, security libs, CI, `amplify.yml` |
| `1ddb0e2` | Booking state machine, catalog, pricing, availability, bookings, admin users |
| `6080ec4` | Stripe Checkout (test mode), payment state funnel, signed webhook, reconcile/cron |
| `95ec122` | Feedback, booking chat (polling), S3 file attachments |
| `7f3e427` | WhatsApp via Meta Cloud API on the shared booking services |
| `92c4e4e` | AI assistant module, reports, admin AI activity |

## Audit findings → fixes → regression tests

| Finding | Fix | Proven by |
|---|---|---|
| **C-1** role from user-writable metadata | Role read from `User.role` on every request; token carries no role | `auth.test.ts` "[C-1] takes the role from the database…", `security.test.ts` "carries no role claim" |
| **C-2** self-registration as admin | Registration always `CLIENT`; `.strict()` rejects `role`; only admin route changes roles | `auth.test.ts` "[C-2] rejects a self-assigned role" |
| **C-3** mass assignment (`status: 'paid'`) | Strict DTOs; status changes only via the state machine; no route targets `PAID` | `booking.test.ts` "[C-3/H-3]…", "[C-3] there is no route that marks a booking paid", `booking.machine.test.ts` |
| **C-4** unauthenticated WhatsApp send | Endpoint removed; staff replies authed, scoped, 24h-window only | `whatsapp.test.ts` dashboard tests |
| **C-5** Twilio tokens returned to users | Meta secrets only in env; channel DTOs have no credentials | schema (no secret columns), `whatsapp/service.ts` |
| **C-6** RLS let any user read all bookings/messages | No browser DB access; all reads via scoped services | `booking.test.ts` IDOR suite, `whatsapp.test.ts` "[H-8]" |
| **H-1** fake "success" on DB errors | All mock fallbacks removed; generic 500 + request id | `withApi.ts` error envelope |
| **H-2** client/provider-chosen amounts | Price snapshotted from pricing; checkout amount from snapshot; webhook amount cross-checked | `payments.test.ts` "[H-2]…", `booking.test.ts` price test |
| **H-3** booking for others / arbitrary status | `clientId` from session; admin-only on-behalf-of | `booking.test.ts` "[H-3]…" |
| **H-4** webhook replay / out-of-order | `WebhookEvent` dedupe; single payment funnel; terminal states never regress | `payments.test.ts` forged/replay/late-expired tests |
| **H-5** WhatsApp signature optional | HMAC always verified; dev bypass refused in production; `wamid` dedupe | `whatsapp.test.ts` "[H-5]…", retry test |
| **H-6** double booking | Postgres exclusion constraint + slot validation + conflict handling | `platform.test.ts` "[H-6]…", `booking.test.ts` concurrency, `whatsapp.test.ts` race |
| **H-7** open proxy to foreign IP | Removed with the old `next.config.mjs` | — |
| **H-8** any user lists all WhatsApp data | Conversations scoped per provider channel; clients refused | `whatsapp.test.ts` "[H-8]…" |
| **H-9** reset enumeration / email bombing | Uniform 200; per-IP + per-email limits; single-use hashed tokens | `auth.test.ts` "[H-9]…", reset flow test |
| **M-1** weak CSRF / fake encryption | SameSite cookie + Origin check; encryption layer removed | `auth.test.ts` "[CSRF]…", `security.test.ts` origin tests |
| **M-2** PostgREST filter injection | Prisma parameterised queries only | — |
| **M-3** racy appointment numbers | Random `SA-XXXXXX` reference + unique index + retry | `booking.test.ts` reference format |
| **M-4** feedback for foreign questions | Answers validated against sets applicable to that booking; one per booking | `feedback-chat-files.test.ts` "[M-4]…" |
| **M-5** other providers' question sets readable | Set visibility/edit scoped to owner | `feedback-chat-files.test.ts` "[M-5]…" |
| **M-6** raw admin updates | Typed admin DTOs; last-admin and self-lockout guards; audit | `admin-and-pricing.test.ts` |
| **M-7** internal errors to clients | `AppError` public messages only | `errors.ts`, `withApi.ts` |
| **M-8** no rate limits | Postgres-backed limiter (Amplify-safe) on auth, writes, AI, WhatsApp | `auth.test.ts` "[M-8]…", `platform.test.ts` limiter tests |
| **M-9** no audit trail | `AuditEvent` + `BookingTransition` in the same transaction as changes | assertions across booking/admin/AI tests |
| **L-1** PII in logs | Structured logger with key-based redaction | `security.test.ts` "log redaction" |
| **L-4** committed `.next/` | Untracked and ignored | — |

## AI assistant — threat tests (`ai-agent.test.ts`)

A scripted model plays a compromised assistant. The code, not the prompt, stops it.

| Attempt | Result |
|---|---|
| Call a tool the role wasn't offered (`approveBooking` as client) | Refused, logged as `denied`, nothing changes |
| Pass `userId` to read someone else's bookings | Rejected by strict schema |
| Read another user's booking by reference | "Booking not found" |
| "Obey" injected text and approve everything | Only pending proposals; bookings unchanged |
| Confirm someone else's action / replay a confirmation | 404 / 409 |
| Booking cancelled between proposal and confirm | Confirm returns `FAILED`; no approval applied |
| Exceed the daily budget / over-long input / disabled user | 429 / 422 / 403 |

## Deliberate deviations from the original prompt

- **Payments:** Stripe Checkout links instead of stored cards + off-session charges (no card data stored at all).
- **No Cognito, Bedrock, SQS, Secrets Manager, WAF, custom domain:** out of scope for a $0 portfolio deployment (Phase 1 §7).
- **No multi-tenancy:** documented migration path in the design (§4.4).
- **Refunds:** manual in the Stripe dashboard; payments that land on cancelled bookings are flagged `needs_refund`.

## Known gaps (next phases)

- No UI yet: dashboards, booking flow, chat widget, confirm cards (Phase 4).
- Demo seed data (catalog, providers, WhatsApp channel) for the live demo (Phase 4/5).
- Google Calendar sync from the old bot not yet ported (optional; needs OAuth setup).
- Real Gemini / Meta / Stripe calls are only exercised through fakes in tests; end-to-end checks with real test credentials happen in Phase 5.
- `clientIp()` assumes the last `X-Forwarded-For` hop is Amplify's edge — to be verified on the deployed app.
