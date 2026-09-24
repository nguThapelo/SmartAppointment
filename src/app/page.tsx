import Link from "next/link";
import {
  ArrowRight, Bot, CalendarCheck2, Check, CreditCard, Lock, MessageCircle, ShieldCheck, Sparkles, Star,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { getPageUser } from "@/server/auth/page";

const FEATURES = [
  { icon: CalendarCheck2, title: "Book on the web", body: "Pick a service, a provider and a genuinely free slot. Providers approve, reschedule and get paid in one place.", tone: "from-brand-400 to-cyan-500", glow: "shadow-glow" },
  { icon: MessageCircle, title: "Or on WhatsApp", body: "Customers book, check, move and cancel by chatting — same rules, same calendar as the website.", tone: "from-emerald-400 to-green-600", glow: "shadow-[0_8px_24px_-6px_rgb(16_185_129/0.45)]" },
  { icon: Sparkles, title: "Or just ask AI", body: "An assistant that searches, checks availability and prepares bookings — and always asks you to confirm.", tone: "from-accent-400 to-fuchsia-500", glow: "shadow-glow-accent" },
  { icon: CreditCard, title: "Paid securely", body: "Stripe Checkout payment links. A booking is only marked paid when Stripe itself says so.", tone: "from-sky-400 to-blue-600", glow: "shadow-[0_8px_24px_-6px_rgb(2_132_199/0.45)]" },
];

const SECURITY = [
  "Roles checked on the server on every request — never trusted from the browser",
  "Double bookings are impossible, enforced by the database itself",
  "The assistant can only use tools your role allows, and nothing changes until you confirm",
  "Signed, de-duplicated webhooks for payments and WhatsApp",
  "A full audit trail of bookings, payments, role changes and assistant actions",
];

/** A static product preview for the hero — pure markup, no data. */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-300/40 via-cyan-200/30 to-accent-300/40 blur-2xl" />
      <div className="relative animate-float rounded-3xl border border-white/70 bg-white/80 p-5 shadow-pop backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-fuchsia-500 text-sm font-semibold text-white">TN</span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Haircut with Thandi</p>
              <p className="text-xs text-ink-500">Tue 29 Sept · 10:00 – 10:45</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Paid
          </span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {["08:00", "08:45", "09:30", "10:15", "11:00"].map((t, i) => (
            <span key={t} className={`rounded-lg py-2 text-center text-xs font-semibold ${i === 2 ? "bg-brand-gradient text-white shadow-glow" : "bg-ink-50 text-ink-600 ring-1 ring-ink-200"}`}>{t}</span>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-300 via-orange-300 to-accent-400 p-px">
          <div className="rounded-[15px] bg-white p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700"><ShieldCheck className="size-3" /> Needs your confirmation</p>
            <p className="mt-1 text-sm text-ink-800">Book a massage with Sipho on Sat 3 Oct, 10:00 for R 550,00.</p>
            <div className="mt-2.5 flex gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-glow"><Check className="size-3.5" /> Confirm</span>
              <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-ink-200">Cancel</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-6 hidden w-60 rotate-[-4deg] rounded-2xl bg-[#e7ffdb] p-3 text-xs text-ink-800 shadow-lift ring-1 ring-emerald-200 sm:block">
        <p className="flex items-center gap-1.5 font-semibold text-emerald-700"><MessageCircle className="size-3.5" /> WhatsApp</p>
        <p className="mt-1">✅ You’re booked! Your reference is <span className="font-mono font-semibold">SA-7K3P9Q</span>.</p>
      </div>
      <div className="absolute -right-4 -top-6 hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 shadow-lift ring-1 ring-ink-200 sm:flex">
        <Star className="size-3.5 fill-amber-400 text-amber-400" /> 3 channels · 1 calendar
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await getPageUser();
  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <div className="bg-hero-gradient">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/dashboard" icon={<ArrowRight className="size-4" />}>Go to dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
                <ButtonLink href="/register">Get started</ButtonLink>
              </>
            )}
          </nav>
        </header>

        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-ink-700 shadow-soft ring-1 ring-ink-200 backdrop-blur">
              <span className="grid size-5 place-items-center rounded-full bg-accent-gradient text-white"><Sparkles className="size-3" /></span>
              Web · WhatsApp · AI assistant
            </p>
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
              Appointments that <span className="text-gradient">book themselves</span> — safely.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
              Clients book however they like. Providers approve, reschedule, get paid and hear feedback — all from one place.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href={user ? "/dashboard" : "/register"} size="lg" icon={<ArrowRight className="size-4" />}>
                {user ? "Open dashboard" : "Create a free account"}
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">Try the demo</ButtonLink>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
              {["No card needed", "Stripe test mode", "Works on mobile"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-4 text-brand-600" /> {t}</span>
              ))}
            </p>
          </div>
          <HeroPreview />
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Three ways in</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-ink-900">One calendar. Every channel.</h2>
          <p className="mt-4 text-ink-500">Whether a client taps, texts or asks — the booking lands in the same place, under the same rules.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, tone, glow }) => (
            <div key={title} className="group rounded-3xl border border-ink-200/70 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
              <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} ${glow} text-white transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f1a33] via-[#122a45] to-[#0d4f4a]">
        <div className="absolute -left-32 top-0 size-[30rem] rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div className="absolute -right-32 bottom-0 size-[30rem] rounded-full bg-accent-600/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300"><ShieldCheck className="size-4" /> Built security-first</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-white">Every channel goes through the same rules.</h2>
            <p className="mt-4 text-white/65">
              The website, the WhatsApp bot and the AI assistant all call one set of server-side services — so permissions, prices, availability and booking states can’t be bypassed from any of them.
            </p>
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <span className="grid size-11 place-items-center rounded-xl bg-accent-gradient text-white shadow-glow-accent"><Bot className="size-5" /></span>
              <p className="text-sm text-white/80">The AI can suggest, but only <span className="font-semibold text-white">you</span> can confirm — and it’s re-checked on the server when you do.</p>
            </div>
          </div>
          <ul className="space-y-3 self-center">
            {SECURITY.map((s) => (
              <li key={s} className="flex gap-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-white/85 ring-1 ring-white/10 transition hover:bg-white/[0.07]">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-400/20 text-brand-200"><Lock className="size-3.5" aria-hidden /></span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-gradient px-8 py-14 text-center text-white shadow-glow sm:px-16">
          <div className="bg-dots absolute inset-0 opacity-20 invert" aria-hidden />
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Ready to take a look?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/85">Sign in with a demo account and try it as a client, a provider or an admin.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-brand-700 shadow-lift transition hover:-translate-y-px hover:shadow-pop">
              Try the demo <ArrowRight className="size-4" />
            </Link>
            <Link href="/register" className="inline-flex h-12 items-center rounded-xl px-6 text-[15px] font-semibold text-white ring-1 ring-white/50 transition hover:bg-white/10">
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-ink-500 sm:px-6">
          <Logo />
          <p>A portfolio project · Payments run in Stripe test mode.</p>
        </div>
      </footer>
    </div>
  );
}
