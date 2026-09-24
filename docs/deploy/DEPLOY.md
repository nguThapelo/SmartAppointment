# Deploying SmartAppointment to AWS (free tier)

A checklist, in order. Budget about 1–2 hours the first time. Everything here is free
(AWS free tier/credits, Neon free plan, Stripe test mode, Meta test number, Gemini free tier).

```
GitHub (main) ──push──▶ AWS Amplify Hosting (Next.js SSR, eu-central-1)
                              │           │            │
                   Neon Postgres     Amazon S3     Stripe · Meta WhatsApp · Gemini
                  (Frankfurt, Prisma)  (files)        (webhooks → /api/webhooks/*)
GitHub Actions: CI on every push · hourly/daily jobs → /api/cron/*
```

**Region:** use **Frankfurt everywhere** — AWS `eu-central-1` for Amplify and S3, Neon `aws-eu-central-1`.
Neon has no African region; keeping the app next to the database matters more than being near users,
because each page makes several database queries.

---

## 0. Before you start

- [ ] **AWS Budgets alarm** (do this first): AWS console → *Billing* → *Budgets* → *Create budget* →
  *Use a template* → **Zero spend budget** → your email. You'll be emailed the moment anything costs money.
- [ ] Generate two secrets (run twice, keep both):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  → one for `SESSION_SECRET`, one for `CRON_SECRET`.
- [ ] Never commit `.env` (it's git-ignored). Production values live only in the Amplify console.

---

## 1. Database — Neon (free)

1. Sign up at **neon.tech** → *New project* → name `smartappointment`, Postgres **16**, region **AWS Europe Central 1 (Frankfurt)**.
2. *Dashboard* → *Connection details* → copy **two** strings:
   - **Pooled** (host contains `-pooler`) → becomes `DATABASE_URL`, add the parameters shown:
     ```
     postgresql://USER:PASSWORD@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15
     ```
   - **Direct** (no `-pooler`) → becomes `DIRECT_DATABASE_URL`:
     ```
     postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
     ```
3. Create the tables and load the admin + demo data **from your machine** (Git Bash, in the project folder):
   ```bash
   export DATABASE_URL='<pooled string>'
   export DIRECT_DATABASE_URL='<direct string>'
   export SEED_ADMIN_EMAIL='you@yourdomain.com'
   export SEED_ADMIN_PASSWORD='<a strong password, 10+ chars>'
   export SEED_DEMO=true
   export SEED_DEMO_PASSWORD='<password for the demo accounts>'
   npx prisma migrate deploy
   npx tsx prisma/seed.ts
   ```
   You should see *Created admin …* and *Demo data ready*. (Future migrations run automatically on every Amplify build.)

---

## 2. File storage — S3

1. S3 console (region **eu-central-1**) → *Create bucket* → e.g. `smartappointment-files-<something-unique>`.
   Keep **Block all public access = ON**, encryption = SSE-S3 (default).
2. Bucket → *Permissions* → *CORS* → paste (you'll add the Amplify URL after step 4):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
3. Bucket → *Management* → *Lifecycle rule* → "delete objects after 1 day" with prefix `bookings/` **only if** you
   want the demo to clean itself up; otherwise skip.

---

## 3. IAM — let the app (and only the app) use the bucket

1. IAM → *Roles* → *Create role* → *Custom trust policy*:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow", "Principal": { "Service": "amplify.amazonaws.com" }, "Action": "sts:AssumeRole" }]
   }
   ```
2. Add an **inline policy** (replace the bucket name) — nothing broader:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::smartappointment-files-XXXX/bookings/*"
     }]
   }
   ```
3. Name it `SmartAppointmentComputeRole`. You'll attach it in step 4.

---

## 4. Hosting — AWS Amplify

1. **Get the code onto `main`** (the new app lives on the `rebuild` branch):
   ```bash
   git switch main
   git merge --ff-only rebuild
   git push origin main
   ```
2. Amplify console (region **eu-central-1**) → *Create new app* → **GitHub** → authorise →
   repo `nguThapelo/SmartAppointment`, branch **main**. It detects Next.js SSR and uses the repo's `amplify.yml`.
3. *Advanced settings* → **Environment variables** (the list `amplify.yml` passes to the app):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_DATABASE_URL` | Neon **direct** string |
   | `SESSION_SECRET` | secret #1 |
   | `CRON_SECRET` | secret #2 |
   | `APP_URL` | `https://placeholder.example` for now — fixed in step 5 |
   | `S3_BUCKET_NAME` | your bucket name |
   | `AI_ENABLED` | `true` |
   | `GEMINI_API_KEY` | from step 7 (can add later) |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | from step 6 (can add later) |
   | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | from step 8 (can add later) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | optional, step 9 |

   ⚠️ Do **not** set any `AWS_*` variables — Amplify reserves that prefix and the build fails. S3 access comes from the role.
4. *Save and deploy*. First build takes ~5 minutes.
5. App settings → **IAM roles** → *Compute role* → choose `SmartAppointmentComputeRole` → save.
6. **If the build fails on the Next.js version** (Amplify's supported Next.js range can lag new releases):
   tell me the error — the fallback is pinning Next.js 15, a small, tested change.

---

## 5. Point the app at its own URL

1. Copy the app URL, e.g. `https://main.d1abc2xyz.amplifyapp.com`.
2. Amplify → *Environment variables* → set `APP_URL` to it → *Redeploy this version*.
3. S3 bucket → *CORS* → add that URL to `AllowedOrigins`.
4. Open the URL → sign in with your `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. 🎉

---

## 6. Payments — Stripe (test mode, free)

1. dashboard.stripe.com → make sure **Test mode** is on.
2. *Developers* → *API keys* → copy the **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY`.
   (The app refuses live keys by design.)
3. *Developers* → *Webhooks* → *Add endpoint*:
   - URL: `https://<your-app-url>/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
4. Copy the endpoint's **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` → redeploy.
5. Test: as the demo provider, open a confirmed online booking → *Request payment*; as the demo client → *Pay* →
   card `4242 4242 4242 4242`, any future date, any CVC. The booking turns **Paid** within seconds.

---

## 7. AI — Gemini (free tier)

1. aistudio.google.com → *Get API key* → *Create API key* → `GEMINI_API_KEY` → redeploy.
2. Without a key the assistant still works in a limited, rule-based mode.
3. Free-tier note: Google may use free-tier prompts to improve its models — fine for demo data.
   The app only sends the model minimal booking data (no emails, phone numbers or notes).

---

## 8. WhatsApp — Meta Cloud API (free test number)

1. developers.facebook.com → *My apps* → *Create app* → type **Business** → add product **WhatsApp**.
2. WhatsApp → *API setup*:
   - note the **Phone number ID** of the free test number;
   - under *To*, add and verify your own phone (up to 5 numbers can message a test number).
3. **Access token.** The one on *API setup* expires after 24h. For the demo, create a permanent one:
   business.facebook.com → *Settings* → *Users* → *System users* → *Add* → *Generate token* for your app
   with `whatsapp_business_messaging` → `WHATSAPP_ACCESS_TOKEN`.
4. *App settings* → *Basic* → **App secret** → `WHATSAPP_APP_SECRET`.
5. Choose any random string → `WHATSAPP_VERIFY_TOKEN`. Redeploy so the app knows it.
6. WhatsApp → *Configuration* → *Webhook* → *Edit*:
   - Callback URL: `https://<your-app-url>/api/webhooks/whatsapp`
   - Verify token: the same random string → *Verify and save*
   - *Webhook fields* → subscribe to **messages**.
7. In SmartAppointment as admin → **WhatsApp → Channels → Add channel**: pick provider *Thandi Nkosi*,
   paste the **Phone number ID**, display number, a welcome message. Turn off the placeholder "Thandi's Salon" channel.
8. Test: from your verified phone, send **hi** to the test number → the booking menu replies.

---

## 9. Email (optional) — Gmail SMTP

Password-reset links and booking notifications. Without SMTP the app works; emails are just skipped.

1. Google account → *Security* → turn on 2-Step Verification → *App passwords* → create one.
2. `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<your gmail>`, `SMTP_PASS=<app password>`,
   `SMTP_FROM=SmartAppointment <your gmail>` → redeploy.

---

## 10. Scheduled jobs — GitHub Actions (free)

Payment reconciliation (hourly) and clean-up (daily) run from `.github/workflows/cron.yml`.

GitHub repo → *Settings* → *Secrets and variables* → *Actions*:
- **Secret** `CRON_SECRET` = the same value as in Amplify
- **Variable** `APP_URL` = your app URL

Test once: *Actions* → *Scheduled jobs* → *Run workflow* → pick `cleanup`.

---

## 11. Verify the live site

```bash
BASE=https://<your-app-url> \
SMOKE_CLIENT_EMAIL=demo.client@smartappointment.local SMOKE_CLIENT_PASSWORD='<SEED_DEMO_PASSWORD>' \
SMOKE_PROVIDER_EMAIL=demo.provider@smartappointment.local SMOKE_PROVIDER_PASSWORD='<SEED_DEMO_PASSWORD>' \
npm run smoke
```

Expect **12/12 checks passed**. Then click through: book → approve → pay (4242…) → complete → feedback,
the AI assistant, and a WhatsApp booking.

---

## Operating it

| Task | How |
|---|---|
| **Deploy** | Push to `main`. CI runs tests; Amplify builds, migrates and deploys. |
| **Roll back** | Amplify → your branch → *Deployments* → pick an earlier build → *Redeploy*. |
| **Back up before a risky change** | Neon → *Branches* → *Create branch* from `main` (instant copy-on-write snapshot). Restore by resetting `main` from it. |
| **Logs** | Amplify → *Monitoring* → *Hosting compute logs* (CloudWatch). Logs are JSON; search for `"level":"error"` or `"metric":"authz.denied"`. |
| **Health** | `https://<your-app-url>/api/health` → `{"status":"ok","database":"ok"}` |
| **Rotate a secret** | Change it in Amplify (and GitHub for `CRON_SECRET`) → redeploy. Changing `SESSION_SECRET` signs everyone out. |
| **Switch off AI spend/abuse** | Set `AI_ENABLED=false` → redeploy, or turn it off per user in *Users*. |

## What costs money (and how to avoid it)

- **Amplify Hosting:** free tier (or new-account credits). A portfolio's traffic stays within it; the Zero-spend budget warns you otherwise.
- **S3:** a few MB of uploads — effectively $0.
- **Neon:** free plan (0.5 GB). No card needed.
- **Stripe / Meta test number / Gemini:** free in test/free modes. **Never** put live Stripe keys in (the app refuses them anyway).
- **Avoid:** RDS, Bedrock, NAT gateways, or a custom domain via Route 53 (~$0.50/month) — none are needed.
