import type { ReactNode } from "react";
import { cx } from "@/lib/format";

type Side = "top" | "bottom" | "left" | "right";

const POSITION: Record<Side, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};
const ARROW: Record<Side, string> = {
  top: "left-1/2 top-full -translate-x-1/2 -translate-y-1",
  bottom: "left-1/2 bottom-full -translate-x-1/2 translate-y-1",
  left: "top-1/2 left-full -translate-y-1/2 -translate-x-1",
  right: "top-1/2 right-full -translate-y-1/2 translate-x-1",
};

/**
 * MUI-style tooltip with an arrow. Appears on hover (after a short delay so
 * it doesn't flicker) and on KEYBOARD focus (:focus-visible) — not after a
 * mouse click, so it doesn't linger. The trigger
 * must carry its own aria-label; the tooltip is a visual duplicate.
 */
export function Tooltip({ label, side = "top", children, className }: { label: string; side?: Side; children: ReactNode; className?: string }) {
  return (
    <span className={cx("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink-900/95 px-2 py-1 text-xs font-medium text-white shadow-pop",
          "opacity-0 transition-opacity delay-0 duration-150 group-hover/tt:opacity-100 group-hover/tt:delay-300 group-has-[:focus-visible]/tt:opacity-100",
          POSITION[side],
        )}
      >
        {label}
        <span className={cx("absolute size-2 rotate-45 bg-ink-900/95", ARROW[side])} aria-hidden />
      </span>
    </span>
  );
}
