# Deploying Appointment Hub to AWS (free tier)

A checklist, in order — everything is done in web consoles, no terminal needed.
Budget about 1–2 hours the first time.

```
GitHub (main) ──push──▶ AWS Amplify Hosting (Next.js SSR, eu-central-1)
                              │              │            │
                  Amazon RDS PostgreSQL   Amazon S3    Stripe · Meta WhatsApp · Gemini
                   (Frankfurt, Prisma)     (files)      (webhooks → /api/webhooks/*)
EventBridge Scheduler → Lambda: hourly/daily jobs → /api/cron/*  ·  Amazon SES: email
GitHub Actions: tests on every push
```

**Region:** use **Frankfurt (`eu-central-1`) for everything** — Amplify, RDS and S3 in one region keeps the app
fast, because each page makes several database queries.

**Cost:** Amplify, S3, Stripe test mode, the Meta test number and Gemini's free tier cost nothing. **RDS is free for
12 months** on accounts created before 15 July 2025 (newer accounts use their sign-up credits); after that a
`db.t4g.micro` is roughly $15–19/month including its public IP. The budget alarm below warns you before any charge.

---

## 0. Before you start

- [ ] **AWS Budgets alarm** (do this first): AWS console → *Billing* → *Budgets* → *Create budget* →
  *Use a template* → **Zero spend budget** → your email. You'll be emailed the moment anything costs money.
- [ ] **Two secrets:** use any password generator (your browser's, Bitwarden, 1Password…) to create **two random
  strings of 64 letters and digits** → one for `SESSION_SECRET`, one for `CRON_SECRET`.
- [ ] Production values live only in the Amplify console — never in the repo.

---

## 1. Database — Amazon RDS for PostgreSQL

1. AWS console (region **eu-central-1**) → **RDS** → *Create database* → **Standard create** → **PostgreSQL** (version 16).
2. *Templates* → **Free tier**.
3. *DB instance identifier* `appointment-hub` · *Master username* `appadmin` · choose a strong *Master password*.
4. *Connectivity* → **Public access: Yes** (Amplify doesn't run inside your VPC) · *VPC security group* →
   *Create new* → `appointment-hub-db`.
5. *Additional configuration* → *Initial database name* `appointmenthub` → **Create database**
   (≈5 minutes, until the status is *Available*).
6. Open the database → *Connectivity & security* → click the security group → *Edit inbound rules* → add
   **PostgreSQL · port 5432 · source 0.0.0.0/0**. (Amplify has no fixed IP addresses; the strong password and
   encrypted connections protect the database.)
7. Copy the **Endpoint** and build your connection string — it's used for *both* database variables in step 4:
   ```
   postgresql://appadmin:<password>@<endpoint>:5432/appointmenthub?sslmode=require&connection_limit=5
   ```
   If the password contains `@`, `#` or `/`, write them as `%40`, `%23`, `%2F`.

The tables, your admin account and the demo data are created **automatically by the first Amplify build**
(step 4) — there's nothing to run yourself.

---

## 2. File storage — S3

1. S3 console (region **eu-central-1**) → *Create bucket* → e.g. `appointmenthub-files-<something-unique>`.
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
       "Resource": "arn:aws:s3:::appointmenthub-files-XXXX/bookings/*"
     }]
   }
   ```
3. Name it `AppointmentHubComputeRole`. You'll attach it in step 4.

---

## 4. Hosting — AWS Amplify

1. Make sure the latest code is on the GitHub repo's `main` branch (check the latest commit on github.com).
2. Amplify console (region **eu-central-1**) → *Create new app* → **GitHub** → authorise →
   repo `nguThapelo/SmartAppointment`, branch **main**. It detects Next.js SSR and uses the repo's `amplify.yml`.
3. *Advanced settings* → **Environment variables** (the list `amplify.yml` passes to the app):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your RDS connection string (step 1) |
   | `DIRECT_DATABASE_URL` | the **same** RDS connection string |
   | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | the admin login you want (password 10+ characters) — created on first build |
   | `SEED_DEMO`, `SEED_DEMO_PASSWORD` | optional: `true` and a password for the demo accounts |
   | `SESSION_SECRET` | secret #1 |
   | `CRON_SECRET` | secret #2 |
   | `APP_URL` | `https://placeholder.example` for now — fixed in step 5 |
   | `S3_BUCKET_NAME` | your bucket name |
   | `S3_REGION` | `eu-central-1` (the bucket's region) |
   | `AI_ENABLED` | `true` |
   | `GEMINI_API_KEY` | from step 7 (can add later) |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | from step 6 (can add later) |
   | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | from step 8 (can add later) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | optional, step 9 |

   ⚠️ Do **not** set any `AWS_*` variables — Amplify reserves that prefix and the build fails. S3 access comes from the role.
4. *Save and deploy*. First build takes ~5 minutes.
5. App settings → **IAM roles** → *Compute role* → choose `AppointmentHubComputeRole` → save.
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
7. In Appointment Hub as admin → **WhatsApp → Channels → Add channel**: pick provider *Thandi Nkosi*,
   paste the **Phone number ID**, display number, a welcome message. Turn off the placeholder "Thandi's Salon" channel.
8. Test: from your verified phone, send **hi** to the test number → the booking menu replies.

---

## 9. Email (optional) — Amazon SES

Password-reset links and booking notifications. Without email settings the app works; emails are just skipped.

1. SES console (region **eu-central-1**) → *Identities* → *Create identity* → **Email address** → your email →
   click the link in the verification email AWS sends you.
2. *SMTP settings* → *Create SMTP credentials* → *Create user* → copy the **SMTP username** and **SMTP password**
   (shown once — download the file).
3. In Amplify: `SMTP_HOST=email-smtp.eu-central-1.amazonaws.com`, `SMTP_PORT=587`,
   `SMTP_USER=<SMTP username>`, `SMTP_PASS=<SMTP password>`, `SMTP_FROM=Appointment Hub <your verified email>`
   → redeploy.
4. **Sandbox:** new SES accounts can only send *to* verified addresses (verify any test recipients the same way
   as step 1). To email anyone, *Account dashboard* → **Request production access** (free, reviewed in about a day).

---

## 10. Scheduled jobs — EventBridge Scheduler + Lambda (always free)

Amplify has no cron, so a small Lambda function calls the app's job endpoints on a schedule: payment
reconciliation hourly, clean-up daily. Both services stay inside AWS's permanent free tier.

**Create the function**
1. Lambda console (region **eu-central-1**) → *Create function* → **Author from scratch** →
   name `appointment-hub-jobs` · runtime **Node.js 22.x** → *Create function*.
2. *Code* tab → open `index.mjs` → replace everything with the contents of
   [`infra/aws/scheduled-jobs-lambda.mjs`](../../infra/aws/scheduled-jobs-lambda.mjs) (open it on GitHub →
   *Copy raw file*) → **Deploy**.
3. *Configuration* → *General configuration* → *Edit* → Timeout **1 min** → save.
4. *Configuration* → *Environment variables* → add `APP_URL` (your app URL) and `CRON_SECRET` (same value as in Amplify).
5. *Test* tab → event JSON `{"jobs": ["cleanup"]}` → **Test** → expect *Succeeded*.

**Create the two schedules**
1. EventBridge console → *Scheduler* → *Schedules* → *Create schedule*:
   - name `appointment-hub-hourly` · **Recurring schedule** · **Cron-based** `17 * * * ? *` · timezone UTC ·
     *Flexible time window* **Off** → *Next*
   - target **AWS Lambda – Invoke** → `appointment-hub-jobs` → payload `{"jobs": ["reconcile-payments"]}` → *Next*
   - *Permissions* → **Create new role for this schedule** → *Next* → *Create schedule*.
2. Repeat with name `appointment-hub-daily` · cron `43 1 * * ? *` · payload `{"jobs": ["close-completed", "cleanup"]}`.

Runs and errors appear under Lambda → `appointment-hub-jobs` → *Monitor* → *View CloudWatch logs*.

---

## 11. Verify the live site

1. Open `https://<your-app-url>/api/health` in the browser → `{"status":"ok","database":"ok"}`.
2. Click through: book (as the demo client) → approve (as the demo provider) → pay (4242…) → complete →
   feedback, then the AI assistant and a WhatsApp booking.

(Optional, for developers: `npm run smoke` runs 12 automated end-to-end checks against the live URL —
see `scripts/smoke.mjs`.)

---

## Operating it

| Task | How |
|---|---|
| **Deploy** | Push to `main`. CI runs tests; Amplify builds, migrates and deploys. |
| **Roll back** | Amplify → your branch → *Deployments* → pick an earlier build → *Redeploy*. |
| **Back up before a risky change** | RDS → your database → *Actions* → *Take snapshot*. Automated daily backups are on by default (7-day retention). Restore = *Restore snapshot* to a new instance, then point `DATABASE_URL` at it. |
| **Logs** | Amplify → *Monitoring* → *Hosting compute logs* (CloudWatch). Logs are JSON; search for `"level":"error"` or `"metric":"authz.denied"`. |
| **Health** | `https://<your-app-url>/api/health` → `{"status":"ok","database":"ok"}` |
| **Rotate a secret** | Change it in Amplify (and in the Lambda for `CRON_SECRET`) → redeploy. Changing `SESSION_SECRET` signs everyone out. |
| **Switch off AI spend/abuse** | Set `AI_ENABLED=false` → redeploy, or turn it off per user in *Users*. |

## What costs money (and how to avoid it)

- **Amplify Hosting:** free tier (or new-account credits). Low traffic stays within it; the Zero-spend budget warns you otherwise.
- **S3:** a few MB of uploads — effectively $0.
- **Lambda + EventBridge Scheduler:** ~750 runs a month; the permanent free tiers are 1 million and 14 million — $0.
- **SES:** free for the first 3,000 emails a month for 12 months, then $0.10 per 1,000 — cents at most.
- **RDS:** free for 12 months on eligible accounts (single-AZ `db.t4g.micro`/`db.t3.micro`, 20 GB). Afterwards roughly $15–19/month — stop or delete the instance if you don't need it.
- **Stripe / Meta test number / Gemini:** free in test/free modes. **Never** put live Stripe keys in (the app refuses them anyway).
- **Avoid:** Multi-AZ RDS, RDS Proxy, NAT gateways — none are needed and all cost money.
