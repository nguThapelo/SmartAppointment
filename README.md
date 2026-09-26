# Appointment Hub

Appointment booking and service management for clients, service providers and administrators —
on the web, over WhatsApp, and through an AI assistant, all backed by one set of business rules.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Prisma · PostgreSQL · Tailwind CSS v4 ·
Stripe Checkout · Meta WhatsApp Cloud API · Google Gemini · AWS Amplify · Amazon S3 · Vitest

---

## Features

**Clients**
- Browse services, compare providers and book a genuinely free time slot
- Reschedule or cancel, pay online via Stripe, message the provider, leave feedback
- Book, view, move and cancel appointments over WhatsApp

**Providers**
- Approve or decline requests, reschedule, mark appointments complete or no-show
- Manage services, prices, weekly hours and holiday exceptions
- Request payment with one click; track earnings; reply to WhatsApp customers

**Administrators**
- Platform metrics, user and role management, service catalogue
- Feedback question sets, WhatsApp channels, audit log and assistant activity

**AI assistant** (every role)
- Answers questions and performs tasks through a fixed set of role-scoped tools
- Any change it proposes is shown as a confirmation card and only runs when the user confirms

## Architecture

```
Browser ─┐                        ┌──────────────── Next.js route handlers (thin) ────────────────┐
WhatsApp ─┼──▶ AWS Amplify (SSR) ──▶ auth · rate limit · CSRF · strict validation · error envelope │
AI chat ─┘                        └───────────────────────────────┬───────────────────────────────┘
                                                                   ▼
                                  Services: booking · availability · pricing · payment · feedback
                                  booking state machine · payment state funnel · audit log
                                                                   ▼
                                  Prisma ──▶ PostgreSQL        S3 (presigned URLs)
Stripe ──webhook──▶ /api/webhooks/stripe      Meta ──webhook──▶ /api/webhooks/whatsapp
```

- **One service layer.** The web UI, the WhatsApp bot and the AI assistant all call the same services,
  so permissions, prices, availability and booking states are enforced identically everywhere.
- **Explicit state machines.** Booking status changes go through a single transition table; payment status
  through a single funnel that ignores late or out-of-order provider events.
- **Database-level integrity.** An exclusion constraint makes overlapping bookings impossible, even under
  concurrent requests; money is stored in integer cents and snapshotted at booking time.
- **AI module** (`src/AI`). Provider-agnostic (Gemini by default, Anthropic optional), with role-filtered tools,
  strict argument validation and a confirm-before-write protocol. See [`src/AI/README.md`](src/AI/README.md).

## Security highlights

- Sessions in httpOnly cookies; roles re-read from the database on every request; instant revocation
- Strict input schemas reject unexpected fields; server-computed prices; ownership checks on every read and write
- Signed and de-duplicated Stripe and WhatsApp webhooks; idempotency keys on booking, payment and feedback
- Postgres-backed rate limiting; origin checks for CSRF; structured logs with automatic redaction
- Append-only audit trail for bookings, payments, role changes and assistant actions

## Getting started

Requirements: Node.js 20.18+, Docker (for a local Postgres).

```bash
docker run -d --name appointmenthub-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=appointmenthub -p 5432:5432 postgres:16-alpine
cp .env.example .env          # fill in DATABASE_URL, DIRECT_DATABASE_URL, SESSION_SECRET, SEED_* …
npm install
npx prisma migrate dev
npm run db:seed               # admin account (+ demo data when SEED_DEMO=true)
npm run dev
```

Stripe, WhatsApp, Gemini, S3 and SMTP are optional locally — each feature switches off gracefully when its
keys are absent. See [`.env.example`](.env.example) for every setting.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit + integration tests against a real Postgres (`<db>_test`) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Production build |
| `npm run db:migrate` · `db:deploy` · `db:seed` | Prisma migrations and seed data |
| `npm run smoke` | End-to-end checks against a running deployment (`BASE=…`) |

## Testing

600+ tests run against a real PostgreSQL database — no database mocks. They cover the booking state machine
exhaustively, access control (including cross-user and cross-provider attempts), concurrency and double-booking,
webhook forgery and replay, idempotency, and the AI assistant's behaviour under prompt injection and tool misuse.

## Deployment

AWS Amplify Hosting (Next.js SSR) with Amazon RDS for PostgreSQL, file storage on S3, email via
Amazon SES, and scheduled jobs from EventBridge Scheduler + Lambda. Step-by-step instructions: [`docs/deploy/DEPLOY.md`](docs/deploy/DEPLOY.md).

## Project documentation

- [Architecture & security review](docs/audit/PHASE-1-AUDIT.md)
- [System design](docs/design/PHASE-2-DESIGN.md)
- [Implementation summary](docs/PHASE-3-SUMMARY.md)
- [Deployment guide](docs/deploy/DEPLOY.md)
