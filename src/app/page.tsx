import Link from "next/link";
import { Bot, CalendarCheck2, CreditCard, Lock, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { getPageUser } from "@/server/auth/page";

const FEATURES = [
  { icon: CalendarCheck2, title: "Book on the web", body: "Pick a service, a provider and a real free slot. Providers approve, reschedule and get paid in one place." },
  { icon: MessageCircle, title: "Or on WhatsApp", body: "Customers book, check, move and cancel by chatting — the same rules and the same calendar as the website." },
  { icon: Bot, title: "Or just ask", body: "An AI assistant that searches, checks availability and prepares bookings — and always asks you to confirm." },
  { icon: CreditCard, title: "Paid securely", body: "Stripe Checkout payment links. A booking is only marked paid when Stripe says so." },
];

const SECURITY = [
  "Roles checked on the server on every request — never trusted from the browser",
  "No double bookings, enforced by the database itself",
  "The assistant can only use tools your role allows, and nothing changes until you confirm",
  "Signed, de-duplicated webhooks for payments and WhatsApp",
  "Full audit trail of bookings, payments, role changes and assistant actions",
];

export default async function Home() {
  const user = await getPageUser();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink href="/dashboard">Go to dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
              <ButtonLink href="/register">Get started</ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:pt-20">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
              <Sparkles className="size-4" /> Web · WhatsApp · AI assistant
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              Appointments that book themselves — safely.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-600">
              SmartAppointment lets clients book services however they like, and gives providers one place to approve, reschedule, get paid and hear feedback.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={user ? "/dashboard" : "/register"} className="h-11 px-5">{user ? "Open dashboard" : "Create a free account"}</ButtonLink>
              <ButtonLink href="/login" variant="secondary" className="h-11 px-5">Try the demo</ButtonLink>
            </div>
          </div>
        </section>

        <section className="border-y border-ink-100 bg-ink-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span className="grid size-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-ink-200">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-semibold text-ink-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-brand-700"><ShieldCheck className="size-4" /> Built security-first</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">Every channel goes through the same rules.</h2>
            <p className="mt-3 text-ink-600">
              The website, the WhatsApp bot and the AI assistant all call one set of server-side services — so permissions, prices, availability and booking states can’t be bypassed from any of them.
            </p>
          </div>
          <ul className="space-y-3">
            {SECURITY.map((s) => (
              <li key={s} className="flex gap-3 text-sm text-ink-700">
                <Lock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-ink-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-ink-500 sm:px-6">
          <p>SmartAppointment — a portfolio project. Payments run in Stripe test mode.</p>
          <Link href="/login" className="hover:text-ink-800">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
