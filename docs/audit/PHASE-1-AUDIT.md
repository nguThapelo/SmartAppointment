# SmartAppointment — Phase 1 Audit & Plan

_Audit date: 2026-09-24 · Scope: committed app (`HEAD` = `ceabcdc`) + uncommitted WhatsApp bot in the working tree · No code was changed in this phase._

---

## 0. TL;DR

1. **There are two apps in this repo, and neither can deploy to Amplify as-is.** Both run a custom Express server (`server.js` / `server/index.mjs`). Amplify Hosting only runs standard Next.js, so every Express route has to become a Next.js route handler. Socket.io chat also can't run there.
2. **The committed app has several ways to escalate privilege or tamper with data** (C-1 to C-6). Any user can make themselves admin. Clients can mark their own bookings as paid. DB failures return fabricated "success" data.
3. **The WhatsApp bot has an open Twilio relay** (`/api/whatsapp/send`, no auth), leaks Twilio auth tokens to any signed-in user, and lets anyone read every customer's bookings and messages through Supabase RLS.
4. **The "AI agent" isn't an agent.** `server/routes/ai.js` is a 32-line keyword matcher with no model and no tools. Nothing needs securing; it needs building (Phase 3), following the ReportReviewAssist `/AI` pattern.
5. **"$0 on AWS" is only partly achievable.** Amplify + S3 fit the free tier. RDS Postgres, Bedrock and Twilio all eventually bill. See §7 for the $0 path and the decisions I need from you (§9).

---

## 1. Architecture summary

| | Committed app (`HEAD`) | WhatsApp bot (working tree, untracked) |
|---|---|---|
| Entry | `server.js` (CJS Express + Next custom server) | `server/index.mjs` (ESM Express + Next custom server) |
| Frontend | Next.js **Pages Router** (`pages/`, `components/`, `hooks/`), MUI-ish components, React Query | Next.js **App Router** (`app/bot/*`, `app/login`, `app/register`), Tailwind, recharts |
| Auth | Supabase JWT → Passport `supabase-bearer` strategy; **role from `user_metadata`** | Supabase JWT → `requireAuth`; **role from `profiles.role`** |
| Data | Supabase Postgres via `supabase-js` service-role client (bypasses RLS) | Same |
| Payments | Stripe SetupIntent / PaymentIntent + webhook | None |
| Realtime | socket.io chat per appointment | Twilio webhook (TwiML reply) |
| Integrations | SMTP (password reset) | Twilio WhatsApp, Google Calendar, SMTP |
| "AI" | Keyword-matching stub | Fixed state machine (`conversationFlow.mjs`) |
| Tests | 2 component tests (`AppointmentForm.test.jsx`, `Navbar.test.jsx`) | None |
| Deploy config | `.travis.yml` (stale) | None |

**Repo hygiene:** `.next/` build output is committed (59 files) and churns on every build. `.env` is correctly ignored and does **not** appear in git history.

---

## 2. Current flows

### 2.1 Roles
- Roles: `admin`, `provider`, `client`. The committed app reads `user.user_metadata.role` and the bot reads `profiles.role`. **Both can be set by the user themselves** (see C-1, C-2).
- First admin comes from `/api/bootstrap/promote-admin`, gated by `ENABLE_ADMIN_BOOTSTRAP` + a shared secret.

### 2.2 Booking lifecycle: committed app (`appointment_status` enum)
`booked → approved | declined → in_progress → paid → completed` → feedback

What the code actually enforces:
- `POST /api/appointments` accepts `status`, `client_id` and `provider_id` from the body.
- `PUT /api/appointments/:id` writes the **raw request body**, so any field can become any value.
- `provider-decision` doesn't check the current status, so a `completed` or `paid` booking can be flipped to `declined`.
- `complete` is the only transition that checks a precondition (payment captured).
- **No explicit state machine exists.**

### 2.3 Payment lifecycle: committed app (`payment_status` enum)
Client saves a card (SetupIntent) → provider calls `/api/payments/initiate` → off-session PaymentIntent → webhook or `/sync-intent` maps the Stripe status onto both `payment_transactions` and `appointments`.
- The amount can come from the request body (`req.body.amount`) instead of the provider's price.
- On failure the webhook moves the appointment to `in_progress`, and a late or out-of-order event can overwrite a later state. Webhook events aren't deduplicated.

### 2.4 WhatsApp bot flow
Twilio → `POST /api/whatsapp/webhook/:serviceId` → `processMessage()` state machine: `IDLE → MAIN_MENU → SERVICE_SELECT → DATE → TIME → NAME → EMAIL → CONFIRM` → `createBooking()` inserts `status='confirmed'`, then sends email and creates a Calendar event (fire-and-forget).
Bot statuses: `pending, confirmed, cancelled, rescheduled, completed, no_show`. Only the admin can confirm, cancel or reschedule through `/api/bot-bookings`.

### 2.5 "Agent" flow
`POST /api/ai/chat` (authenticated) → lowercases the message → returns one of three canned strings. No model, no tools, no state.

---

## 3. Security findings

Severity is judged for a public portfolio deployment where anyone can register.

### Critical

| ID | Where | Issue → exploit | Fix | Regression test |
|---|---|---|---|---|
| C-1 | `server/middleware/role.js` `getUserRole` (HEAD) | Role comes from `user_metadata`, which **any Supabase user can write** with `supabase.auth.updateUser({ data: { role: 'admin' } })` using the public anon key. The result is full admin. | Role lives only in our own `User.role` DB column and is never taken from anything the client can write. | A client updating their own metadata or profile still gets 403 on admin routes |
| C-2 | `20260228_structured_upgrade.sql` `handle_new_user()` + `profiles` RLS `for all using auth.uid()=id` | Registering with `{ role: 'admin' }` in metadata creates an admin profile. The RLS policy also lets users `UPDATE profiles SET role='admin'` on their own row, which the bot's `requireAuth` trusts. | Registration always creates a `CLIENT`. Only an admin endpoint can change roles, and it writes an audit event. | Register with a role field → role is CLIENT |
| C-3 | `server/routes/appointments.js` `PUT /:id` (HEAD) | `.update(req.body)` is mass assignment. A client can send `{status:'paid', amount_paid: 999, provider_id: X}` on their own booking. | Allow-listed zod `.strict()` DTO per action. Status changes only go through the state machine. | A client PUT with `status` or `amount_paid` → 422 and no change |
| C-4 | `server/routes/whatsapp.mjs` `POST /send` | **No authentication at all.** Anyone can send arbitrary WhatsApp messages from your Twilio number to any phone, which means toll fraud, spam and a banned number. | Remove it, or make it admin-only + rate-limited + template-only. | Unauthenticated POST → 401 |
| C-5 | `server/routes/botServices.mjs` `GET /`, `GET /:id` | `select('*')` returns `twilio_auth_token` and `twilio_account_sid` to **every signed-in user**, including self-registered clients. | Keep secrets in env / Secrets Manager, never in the table. The response DTO omits them. | Client GET → response has no credential fields |
| C-6 | `20260518_whatsapp_bot.sql` RLS `TO authenticated USING (true)` on bookings, messages, conversations | Any registered user can use the browser anon key to read **every customer's phone number, name, email and message history**. | Moot after moving to Prisma (no browser DB access). Until then, restrict it to admins. | n/a after migration; list endpoints return 403 for clients |

### High

| ID | Where | Issue → exploit | Fix | Test |
|---|---|---|---|---|
| H-1 | All HEAD routes (`appointments`, `admin`, `feedback`, `payments`) | **Mock-data fallback.** On any DB error the API returns `201`/`200` with fabricated rows: fake bookings, fake users, fake card `4242`, fake deletes. Users are told actions succeeded when they didn't. | Delete all mock fallbacks. Return a generic 500 with a request ID. | Simulate a DB error → 5xx and no fake body |
| H-2 | `payments.js` `POST /initiate` | Amount and currency come from `req.body`, so a provider can charge any amount. It also sets appointment status straight from the PaymentIntent response. | Amount is computed server-side from the booking's price. Status changes only through the payment state funnel. | Body amount is ignored |
| H-3 | `appointments.js` `POST /` | Takes `client_id`, `provider_id`, `status` and the price from the body. A client can book on behalf of another user or insert `status:'paid'`. | `clientId` comes from the session. Status is always `PENDING`. Provider/service must exist and be active. | A client supplying another `client_id` → it's ignored |
| H-4 | `paymentsWebhook.js` | Events aren't deduplicated or ordered. A late `processing` event can overwrite `succeeded`, and failure resets the appointment to `in_progress`. | `WebhookEvent` table with unique `(provider, eventId)`, plus a peach-payment style `applyPaymentOutcome` funnel that rejects terminal→non-terminal moves. | Replaying the same event → no-op. `succeeded` then `processing` → stays paid |
| H-5 | `whatsapp.mjs` webhook | Signature is checked **only if** `NODE_ENV==='production'` **and** a token is set; otherwise anyone can inject messages and bookings. Twilio retries aren't deduplicated by `MessageSid`, so one message can create two bookings. | Always verify the signature (skip only with an explicit `WHATSAPP_SKIP_SIGNATURE=true` for local dev). Unique `messageSid`. | Bad signature → 403. Same SID twice → one booking |
| H-6 | `bookingService.mjs` + `conversationFlow.mjs` CONFIRM step | Slot availability is checked at TIME and not re-checked at CONFIRM, and there's no DB constraint, so two users can take the same slot. The same applies to web bookings. | Partial unique index `(serviceId, date, time) WHERE status IN (active statuses)` and handle P2002 as "slot taken". | Two concurrent confirms → one succeeds |
| H-7 | `next.config.mjs` rewrite `/api/external/:path*` → `http://185.220.204.117:2606/Flexify/...` | An unexplained open proxy from your domain to a hardcoded foreign IP over plain HTTP. It has nothing to do with this app. | Remove it. | n/a |
| H-8 | `bot-bookings` / `bot-conversations` / `bot-services` GETs | Only require `requireAuth`, so **any client** can list all bookings, conversations and messages. | Role- and ownership-scoped queries (admin: all; provider: own services; client: own bookings). | Client list → only their own rows |
| H-9 | `auth.js` `POST /forgot-password` | Not rate-limited (email bombing), and it returns 500 for unknown emails vs 200 for known ones (user enumeration). | Always return 200. Rate limit per IP + email. | Unknown email → 200 |

### Medium

| ID | Where | Issue | Fix |
|---|---|---|---|
| M-1 | `security.js` | `CSRF_SECRET` falls back to `'csrf-secret'`. The "request encryption" key can come from `NEXT_PUBLIC_*`, so it ships to the browser, which makes the encryption pointless. | Drop payload "encryption". Use a SameSite=strict httpOnly cookie + Origin check (briefcase/peach pattern). |
| M-2 | `botBookings.mjs` `GET /?search=` | `search` is interpolated into PostgREST `.or()`, which allows filter injection. | Goes away with Prisma parameterised queries. |
| M-3 | `appointments.js` `generateAppointmentNumber` | Count + 1 races and produces duplicates. | Random / sequence-based number + unique constraint. |
| M-4 | `feedback.js` `POST /responses` | Doesn't check that `question_id`s belong to a question set that applies to this booking. `provider_id` falls back to `'provider-1'`. A failed item insert still returns 201. | Validate the set, do everything in one transaction, fail loudly. |
| M-5 | `feedback.js` `GET /questions` | Any role can read any question set by ID, including another provider's private set. | Scope by set ownership. |
| M-6 | `admin.js` `PUT /users/:id`, `PUT /bookings/:id` | Replaces all metadata or writes the raw body. | Typed DTOs + audit event. |
| M-7 | Everywhere | `error.message` from DB/Stripe is returned to the client. | Generic message + request ID. Detailed log server-side. |
| M-8 | Everywhere | No rate limiting on login, register, AI or webhooks. | peach-payment `rateLimit` (in-memory per Lambda; good enough for a portfolio). |
| M-9 | Everywhere | No audit trail for role changes, status transitions or payments. | `AuditEvent` + `BookingTransition` tables. |

### Low
- L-1: `console.error(err)` logs full errors, including customer phone numbers → use a structured logger with redaction (peach `log.js`).
- L-2: Twilio reply template errors are swallowed. Calendar/email side effects are fire-and-forget with no record of whether they happened → store `emailSent` / `calendarSynced` outcomes.
- L-3: `images.remotePatterns: hostname '**'` → restrict it.
- L-4: `.next/` committed → untrack it.

---

## 4. Agent audit (against the prompt's checklist)

The existing agent (`server/routes/ai.js`) has **no model, no tools, no data access and no side effects**, so the prompt-injection, tool-misuse, IDOR and payment-leakage risks **do not apply to current code.** It is authenticated (Passport), but it isn't rate-limited. That's harmless today because it makes no model calls.

The real risk is in the next step. The rebuild needs to add an LLM with write tools, and every finding in §3 (trusting body IDs, raw updates, no state machine) would be inherited by agent tools that wrap those routes. **So the agent must be built on top of the fixed service layer, not the current routes.** That's why the implementation order below does services and the state machine before the agent.

Design, copied from ReportReviewAssist `/AI` and extended for writes:
- `AI/` is a self-contained module with no `req`/`res`. Route handlers own auth, rate limiting, token budget and the response envelope.
- The **actor is bound server-side** (`{ userId, role }` from the session). Tools receive it as a parameter and ignore any user or client ID the model supplies, the same way `executeTool(name, input, authorizedReviewID)` works in ReportReviewAssist.
- Tools are **allow-listed per role** and tools the actor's role doesn't allow are never sent to the model. Every tool input is validated with a strict zod schema.
- **Write tools never execute directly.** They return a `pendingAction` (signed, short-lived, single-use token plus a human summary). The UI shows a confirm dialog, and `POST /api/ai/confirm` executes it through the same service function the normal UI uses, with an idempotency key.
- Tools call **services** (`src/server/services/*`), never Prisma directly and never raw SQL.
- Guardrails: length cap + scope guard (`checkScope`), no reading back of the system prompt, and untrusted text (notes, feedback, descriptions) wrapped as data.
- Provider registry + fallback chain. The final fallback is the existing keyword stub (no local transformer model, since it's too big for Amplify SSR).
- `AgentToolCall` log stores tool name, status, duration and actor, **without** raw message content.
- The WhatsApp bot stays a deterministic state machine. It's cheaper, predictable, and customers on WhatsApp are unauthenticated. An optional "free-text" AI step could come later, limited to read-only tools.

---

## 5. Database & API findings

- **Two disconnected schemas.** `appointments` (web, FK to `auth.users`) and `whatsapp_bookings` (phone-keyed, no user) don't link. Proposal: **one `Booking` table** with `channel = WEB | WHATSAPP`, nullable `clientId`, and `customerPhone`/`customerName` for WhatsApp guests.
- **Everything is tied to Supabase** (`auth.users` FKs, RLS, `auth.uid()`, triggers). Moving to Prisma + RDS means a new schema. The data looks like demo data, so I'm proposing a **fresh Prisma schema + seed** rather than a data migration. Tell me if there's real data to keep.
- Missing: unique active-slot constraint, `AuditEvent`, `BookingTransition`, `IdempotencyKey`, `WebhookEvent`, `AgentConversation`/`AgentToolCall`, `Notification`, soft delete on users/services, `updatedAt` on several tables.
- Enum drift: web uses `booked/approved/in_progress/paid`, the bot uses `pending/confirmed/...`, and payments mix Stripe's own statuses. They'll be unified in §8.
- No DTO layer. Raw rows (including secrets) are returned everywhere.
- Multi-tenancy: **not present and not recommended for this scope.** The bot's `WhatsAppService` already acts as a light "business" boundary. I'll add `organizationId` only if you want to show multi-tenancy as a portfolio feature.

---

## 6. Deployment blockers (AWS Amplify)

1. **Custom Express server.** Amplify runs `next build` output only. All 15+ Express routers need to become `app/api/**/route.ts` handlers. This is the biggest piece of work.
2. **Socket.io.** No websockets on Amplify SSR. Replace appointment chat with polling (React Query `refetchInterval`).
3. **Two routers.** Pages Router (HEAD) + App Router (bot) → consolidate on App Router (briefcase pattern).
4. **Supabase dependency.** Auth + DB → own auth (jose + bcrypt httpOnly cookie, as in briefcase but multi-user with roles in DB) + Prisma/Postgres.
5. **Env vars at SSR runtime.** Needs briefcase's `amplify.yml` trick of writing them to `.env.production`.
6. **Scheduled work** (reminders, payment reconciliation). Amplify has no cron → a GitHub Actions scheduled workflow calls a secret-protected endpoint (free).
7. `.travis.yml` is stale → replace it with the briefcase GitHub Actions CI.

---

## 7. AWS cost assessment: what "$0" really means

| Component | Plan | Free? |
|---|---|---|
| Hosting | **Amplify Hosting** (SSR) | ✅ Legacy free tier: 1,000 build-min, 15 GB out, 500k SSR requests/mo for 12 months. A tiny portfolio app usually stays at or near $0 afterwards too. |
| Files | **S3**, private bucket, presigned URLs | ✅ 5 GB on the free tier; cents afterwards |
| Postgres | **RDS db.t4g.micro** | ⚠️ **Free for 12 months only** (legacy accounts), then roughly $12–15/mo **plus about $3.60/mo for its public IPv4**. AWS accounts created after 15 Jul 2025 get credits (up to $200 / 6 months) instead of the 12-month tier. |
| Postgres alternative | **Neon** free tier (serverless Postgres, 0.5 GB) | ✅ Free indefinitely. Not AWS, but Prisma doesn't care, and switching back to RDS later is just a different `DATABASE_URL`. |
| AI | Amazon **Bedrock** | ❌ Pay per token, no free tier |
| AI alternative | **Gemini API** free tier (via the provider registry) | ✅ Free with rate limits (free-tier data may be used by Google for training, which is fine for demo data) |
| WhatsApp | **Twilio** (current) | ⚠️ Sandbox works on trial credit, but every message costs after that |
| WhatsApp alternative | **Meta WhatsApp Cloud API** direct | ✅ Replies inside the customer-initiated service window are free, which is exactly a booking bot's pattern. Free test number. |
| Email | Keep **SMTP** (Gmail app password) | ✅ SES is optional |
| Payments | **Stripe test mode** | ✅ Always free. Never goes live for a portfolio. |
| Auth | Own auth (jose + bcrypt) | ✅ Cognito's free tier also works, but adds complexity for no portfolio value |
| Logs | CloudWatch (Amplify SSR logs) | ✅ 5 GB free |
| **Guardrail** | **AWS Budgets alert at $1** | ✅ Free. Strongly recommended before creating anything. |

Skipping as agreed: custom domain/ACM, WAF, Cognito, SQS, KMS CMKs, Secrets Manager (about $0.40/secret/mo; Amplify env vars instead, as in briefcase), and multi-environment staging stacks. Amplify branch previews give you a free "staging".

---

## 8. Target design (preview of Phase 2)

**Stack:** Next.js 15 App Router (TypeScript) · Prisma · Postgres · S3 · Tailwind · zod · jose/bcrypt · Amplify · GitHub Actions.

```
src/
  app/                 pages + app/api/**/route.ts (thin: auth → validate → service → DTO)
  AI/                  ReportReviewAssist-style module (providers/ prompts/ tools/ guardrails/ orchestration/)
  server/
    auth/              session.ts (jose cookie), password.ts, requireUser(role)
    security/          rateLimit, idempotency, csrf/origin check, webhook signatures   ← peach-payment
    services/          booking, payment, feedback, catalog, user, whatsapp, calendar, email
    state/             booking.machine.ts, payment.state.ts (only place status changes)
    log.ts, audit.ts, errors.ts, dto/
  lib/                 db.ts, s3.ts                                                   ← briefcase
prisma/schema.prisma
```

**Unified booking state machine** (web + WhatsApp):
```
PENDING ─approve(provider)→ APPROVED ─initiatePayment(provider)→ PAYMENT_PENDING ─webhook→ PAID ─complete(provider)→ COMPLETED ─feedback(client)→ CLOSED
   │                           │                                     │ webhook fail → PAYMENT_FAILED → (retry) PAYMENT_PENDING
   ├─decline(provider)→ DECLINED ├─cancel(client/provider)→ CANCELLED ├─cancel → CANCELLED
   └─cancel(client)→ CANCELLED   └─reschedule → APPROVED (new slot)    PAID ─no_show(provider)→ NO_SHOW
WhatsApp bookings: PENDING → APPROVED (auto, or admin/provider confirm) → COMPLETED/NO_SHOW (pay-on-site: no payment states)
```

---

## 9. Recommended implementation order

1. **Safety first (small, now):** commit the WhatsApp work to a branch, untrack `.next/`, remove the `/api/external` proxy and the open `/api/whatsapp/send`.
2. **Scaffold:** App Router + TS, Prisma schema, `db.ts`/`s3.ts`, auth (session + roles in DB), security libs, logger, errors, CI, `amplify.yml`.
3. **Services + state machine + audit** (booking, catalog, payment, feedback, users) with unit tests (roles, ownership, transitions, idempotency).
4. **API route handlers** replacing the Express routers, with IDOR / mass-assignment regression tests for every finding in §3.
5. **WhatsApp:** webhook route with signature check + `messageSid` dedupe + slot-constraint handling. Provider adapter (Twilio or Meta).
6. **Stripe test-mode** payments with a webhook funnel + dedupe.
7. **`AI/` module:** read tools → write tools with confirm flow → role-specific chat UI.
8. **Frontend:** port dashboards (client/provider/admin) + bot pages to App Router, polling chat, confirm dialogs, auth-expiry handling.
9. **Deploy:** AWS Budgets alarm → S3 + DB → Amplify connected to GitHub → smoke test → README/deploy docs.
10. **Phase 6 review:** security re-test, cost check, final summary.

Steps 2–4 are the bulk of the work. Nothing in steps 5–8 is safe to build until they're done.
