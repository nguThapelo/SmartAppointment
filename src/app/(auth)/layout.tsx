import type { ReactNode } from "react";
import { CalendarCheck2, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand";

// Split screen: brand story on the left (desktop), frosted-glass form card on
// a glowing gradient backdrop (peach-payment AuthShell style).
const POINTS = [
  { icon: CalendarCheck2, text: "Real-time availability — never double-booked" },
  { icon: MessageCircle, text: "Book, move or cancel right from WhatsApp" },
  { icon: Sparkles, text: "A smart assistant that books for you" },
  { icon: ShieldCheck, text: "Secure online payments" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="bg-sidebar-gradient relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 right-0 size-[26rem] rounded-full bg-accent-600/25 blur-3xl" aria-hidden />
        <div className="bg-dots absolute inset-0 opacity-[0.15] invert" aria-hidden />
        <div className="relative"><Logo tone="light" /></div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Appointments that <span className="bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">book themselves</span>.
          </h2>
          <p className="mt-4 text-white/65">Bookings, payments and client messages — all in one place, on any device.</p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icon className="size-4 text-brand-200" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Appointment Hub</p>
      </section>

      {/* Form side */}
      <section className="relative flex items-center justify-center bg-gradient-to-br from-[#eef8f6] via-[#eaf3f8] to-[#efeefc] px-4 py-12">
        <div className="absolute -right-32 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(19_168_142/0.30),transparent_70%)]" aria-hidden />
        <div className="absolute -bottom-48 -left-40 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(124_58_237/0.20),transparent_70%)]" aria-hidden />
        <div className="relative w-full max-w-[26rem]">
          <div className="mb-8 flex justify-center lg:hidden"><Logo /></div>
          <div className="animate-fade-up rounded-3xl border border-white/70 bg-white/80 p-7 shadow-[0_24px_60px_-12px_rgb(14_110_97/0.25),0_8px_24px_-8px_rgb(17_20_31/0.12)] backdrop-blur-xl sm:p-9">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
