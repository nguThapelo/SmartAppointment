"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Home, RotateCcw } from "lucide-react";

// Full-screen error page in the ReportReviewAssist style: deep navy gradient,
// floating multi-coloured hexagon outlines, bubbles drifting up behind, big
// status number, outlined button that inverts on hover. Plus peach-payment's
// auto-redirect countdown. Messages are plain text, never HTML.

const HEXAGONS = [
  { d: "M353,9 L626.664028,170 L626.664028,487 L353,642 L79.3359724,487 L79.3359724,170 L353,9 Z", stroke: "#2cc6a8", delay: "0s" },
  { d: "M78.5,529 L147,569.186414 L147,648.311216 L78.5,687 L10,648.311216 L10,569.186414 L78.5,529 Z", stroke: "#f43f5e", delay: "0.2s" },
  { d: "M773,186 L827,217.538705 L827,279.636651 L773,310 L719,279.636651 L719,217.538705 L773,186 Z", stroke: "#a78bfa", delay: "0.4s" },
  { d: "M639,529 L773,607.846761 L773,763.091627 L639,839 L505,763.091627 L505,607.846761 L639,529 Z", stroke: "#fb923c", delay: "0.6s" },
  { d: "M281,801 L383,861.025276 L383,979.21169 L281,1037 L179,979.21169 L179,861.025276 L281,801 Z", stroke: "#22d3ee", delay: "0.8s" },
];

const BUBBLE_COLORS = ["#2cc6a8", "#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#60a5fa", "#34d399", "#fb7185"];

interface Bubble {
  size: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

function Bubbles() {
  // Generated after mount so server and client renders match (no hydration mismatch).
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setBubbles(
        Array.from({ length: 28 }, () => ({
          size: Math.random() * 34 + 12,
          left: Math.random() * 100,
          delay: Math.random() * 10,
          duration: Math.random() * 8 + 10,
          color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)]!,
        })),
      ),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-[-60px] rounded-full"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at 30% 30%, #ffffffaa, ${b.color}88 45%, ${b.color}33 70%)`,
            boxShadow: `0 0 18px ${b.color}66`,
            animation: `bubble-rise ${b.duration}s linear ${b.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bubble-rise {
          0% { transform: translateY(0) scale(0.9); opacity: 0; }
          10% { opacity: 0.8; }
          100% { transform: translateY(-115vh) scale(1.1); opacity: 0; }
        }
        @keyframes hex-float { to { transform: translateY(22px); } }
      `}</style>
    </div>
  );
}

export function ErrorScreen({
  code,
  title,
  message,
  href = "/",
  label = "Go to home page",
  redirectSeconds = 0,
  onRetry,
}: {
  code: string | number;
  title: string;
  message: string;
  href?: string;
  label?: string;
  redirectSeconds?: number;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(redirectSeconds);

  useEffect(() => {
    if (!redirectSeconds) return;
    const tick = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const go = setTimeout(() => router.replace(href), redirectSeconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [href, redirectSeconds, router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f1a33] via-[#15284f] to-[#1d3a6e] px-6 py-16 text-white">
      <div className="absolute -left-40 -top-40 size-[36rem] rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -right-40 size-[36rem] rounded-full bg-accent-600/25 blur-3xl" aria-hidden />
      <Bubbles />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:justify-center md:gap-16">
        <svg viewBox="0 0 837 1045" className="h-64 w-auto shrink-0 drop-shadow-[0_0_24px_rgb(44_198_168/0.25)] sm:h-80 md:h-[26rem]" aria-hidden>
          <g fill="none" fillRule="evenodd" strokeWidth="6">
            {HEXAGONS.map((h) => (
              <path
                key={h.d}
                d={h.d}
                stroke={h.stroke}
                style={{ animation: `hex-float 1.1s ease-in-out ${h.delay} infinite alternate` }}
              />
            ))}
          </g>
        </svg>

        <div className="max-w-md animate-fade-up text-center md:text-left">
          <p className="bg-gradient-to-br from-white via-brand-200 to-cyan-300 bg-clip-text font-[family-name:var(--font-display)] text-8xl font-extrabold leading-none tracking-tighter text-transparent sm:text-9xl">
            {code}
          </p>
          <h1 className="mt-4 text-2xl font-bold">{title}</h1>
          <p className="mt-2 whitespace-pre-line text-white/70">{message}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href={href}
              className="inline-flex items-center gap-2 rounded-xl border border-white/80 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white hover:text-[#15284f] hover:shadow-[0_10px_30px_-8px_rgb(255_255_255/0.5)]"
            >
              <Home className="size-4" /> {label}
            </Link>
            {onRetry ? (
              <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
                <RotateCcw className="size-4" /> Try again
              </button>
            ) : (
              <button onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
                <ArrowLeft className="size-4" /> Go back
              </button>
            )}
          </div>
          {redirectSeconds > 0 && (
            <p className="mt-4 text-xs text-white/50" aria-live="polite">Taking you there in {left}s…</p>
          )}
        </div>
      </div>
    </main>
  );
}
