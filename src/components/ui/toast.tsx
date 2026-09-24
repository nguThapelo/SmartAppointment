"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cx } from "@/lib/format";

// MUI-style snackbars ("filled" Alert look): coloured by severity, icon,
// optional title, close button, auto-hide progress bar that pauses while
// hovered. Stacked top-right under the app bar (clear of the sidebar and the
// AI button), announced politely
// to screen readers. Replaces any need for browser alert() popups.

export type Severity = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  title?: string;
  severity: Severity;
  duration: number;
}

interface ToastOptions {
  title?: string;
  duration?: number;
}

type Push = (message: string, severity?: Severity, options?: ToastOptions) => void;

const ToastContext = createContext<Push>(() => {});

const STYLE: Record<Severity, { box: string; icon: typeof CheckCircle2; bar: string }> = {
  success: { box: "bg-gradient-to-br from-emerald-600 to-teal-600 shadow-[0_12px_32px_-10px_rgb(5_150_105/0.6)]", icon: CheckCircle2, bar: "bg-white/50" },
  error: { box: "bg-gradient-to-br from-rose-600 to-red-600 shadow-[0_12px_32px_-10px_rgb(225_29_72/0.6)]", icon: XCircle, bar: "bg-white/50" },
  warning: { box: "bg-gradient-to-br from-amber-500 to-orange-500 shadow-[0_12px_32px_-10px_rgb(245_158_11/0.6)]", icon: AlertTriangle, bar: "bg-white/60" },
  info: { box: "bg-gradient-to-br from-sky-600 to-blue-600 shadow-[0_12px_32px_-10px_rgb(2_132_199/0.6)]", icon: Info, bar: "bg-white/50" },
};

function Snackbar({ t, onClose }: { t: ToastItem; onClose: () => void }) {
  const { box, icon: Icon, bar } = STYLE[t.severity];
  const [paused, setPaused] = useState(false);
  return (
    <div
      role={t.severity === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cx("pointer-events-auto relative w-[min(24rem,calc(100vw-2rem))] animate-toast-in overflow-hidden rounded-xl text-white", box)}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          {t.title && <p className="font-semibold">{t.title}</p>}
          <p className={cx(t.title && "text-white/90")}>{t.message}</p>
        </div>
        <button onClick={onClose} aria-label="Dismiss" className="-mr-1 rounded-md p-1 text-white/80 transition hover:bg-white/15 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
      <div
        className={cx("absolute bottom-0 left-0 h-[3px] w-full origin-left", bar)}
        style={{ animation: `toast-progress ${t.duration}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
        onAnimationEnd={onClose}
        aria-hidden
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>((message, severity = "success", options = {}) => {
    const id = nextId.current++;
    const duration = options.duration ?? (severity === "error" ? 7000 : 4500);
    setToasts((all) => [...all.slice(-3), { id, message, severity, title: options.title, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-[60] flex flex-col gap-2.5 sm:right-6">
        {toasts.map((t) => (
          <Snackbar key={t.id} t={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** toast("Saved") · toast("Couldn't save", "error", { title: "Payment" }) */
export const useToast = () => useContext(ToastContext);
