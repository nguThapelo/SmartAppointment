"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

// Native <dialog>: focus trapping, Esc to close and inert background come
// from the browser, which beats re-implementing them.

export function Dialog({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-ink-200/70 bg-white p-0 shadow-pop open:animate-pop-in backdrop:bg-ink-950/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
        <h2 id="dialog-title" className="text-base font-bold text-ink-900">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-ink-100 bg-ink-50/60 px-5 py-3">{footer}</div>}
    </dialog>
  );
}
