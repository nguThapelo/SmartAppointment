"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, RotateCcw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";
import { cx } from "@/lib/format";

// Chat UI for the assistant. Replies are rendered as PLAIN TEXT (never HTML or
// markdown-to-HTML), so nothing the model or tool data says can inject markup.
// Write actions appear as confirm cards built from the server-written summary;
// only pressing Confirm executes them, and the result shown is the server's.

interface Msg {
  role: "user" | "assistant";
  content: string;
}
interface PendingAction {
  id: string;
  summary: string;
  expiresAt: string;
  state?: "confirming" | "cancelling" | "done" | "failed" | "cancelled";
  result?: string;
}
interface TurnResult {
  conversationId: string;
  reply: string;
  pendingActions: PendingAction[];
}

const STORAGE_KEY = "ah.assistant.conversation";
const SUGGESTIONS = ["What bookings do I have coming up?", "Find me a haircut this week", "How do payments work?"];

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStored(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: conversation just won't persist across pages */
  }
}

export function AssistantPanel({ compact = false, conversationId: initialId }: { compact?: boolean; conversationId?: string }) {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(initialId ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Restore the current conversation (from props or this tab's session).
  useEffect(() => {
    const id = initialId ?? readStored();
    if (!id) return;
    api<{ id: string; messages: Msg[]; pendingActions: PendingAction[] }>(`/api/ai/conversations/${id}`)
      .then((c) => {
        setConversationId(c.id);
        setMessages(c.messages.filter((m) => m.role === "user" || m.role === "assistant"));
        setActions(c.pendingActions);
      })
      .catch(() => writeStored(null));
  }, [initialId]);

  // Block body on purpose: newer browsers return a Promise from scrollIntoView,
  // and React treats any returned value as a cleanup function.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, actions, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    setSending(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    try {
      const r = await api<TurnResult>("/api/ai/chat", { body: { message, ...(conversationId ? { conversationId } : {}) } });
      setConversationId(r.conversationId);
      writeStored(r.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
      if (r.pendingActions.length) setActions((a) => [...a, ...r.pendingActions]);
    } catch (err) {
      setError(errorMessage(err));
      setMessages((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setSending(false);
    }
  }

  async function resolve(action: PendingAction, how: "confirm" | "cancel") {
    const update = (patch: Partial<PendingAction>) => setActions((all) => all.map((a) => (a.id === action.id ? { ...a, ...patch } : a)));
    update({ state: how === "confirm" ? "confirming" : "cancelling" });
    try {
      if (how === "cancel") {
        await api(`/api/ai/actions/${action.id}/cancel`, { method: "POST" });
        update({ state: "cancelled" });
        return;
      }
      const r = await api<{ status: "EXECUTED" | "FAILED"; message?: string }>(`/api/ai/actions/${action.id}/confirm`, { method: "POST" });
      if (r.status === "EXECUTED") {
        update({ state: "done" });
        // Anything on screen that this action affected should refresh.
        await qc.invalidateQueries();
      } else {
        update({ state: "failed", result: r.message });
      }
    } catch (err) {
      update({ state: "failed", result: errorMessage(err) });
    }
  }

  function newChat() {
    setConversationId(null);
    writeStored(null);
    setMessages([]);
    setActions([]);
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col bg-gradient-to-b from-white to-ink-50/60", !compact && "h-[calc(100vh-13rem)] overflow-hidden rounded-3xl border border-ink-200/70 shadow-card")}>
      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite" aria-busy={sending}>
        {messages.length === 0 && (
          <div className="flex animate-fade-up flex-col items-center gap-4 py-8 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-accent-500/30 blur-xl" aria-hidden />
              <div className="relative grid size-16 place-items-center rounded-3xl bg-accent-gradient text-white shadow-glow-accent">
                <Sparkles className="size-7" aria-hidden />
              </div>
            </div>
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg font-bold text-ink-900">How can I help?</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">Ask about services, availability or your bookings. I’ll always ask before changing anything.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-ink-700 shadow-soft ring-1 ring-ink-200 transition hover:-translate-y-px hover:text-accent-700 hover:ring-accent-400/60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex animate-fade-up justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-gradient px-4 py-2.5 text-sm leading-relaxed text-white shadow-glow">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex animate-fade-up items-end gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-gradient text-white shadow-glow-accent" aria-hidden>
                <Sparkles className="size-3.5" />
              </span>
              {/* Plain text only: model output is never rendered as HTML. */}
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm leading-relaxed text-ink-800 shadow-soft ring-1 ring-ink-200/70">
                {m.content}
              </p>
            </div>
          ),
        )}

        {actions.map((a) => (
          <div key={a.id} className="animate-pop-in rounded-2xl bg-gradient-to-br from-amber-300 via-orange-300 to-accent-400 p-px shadow-card">
            <div className="rounded-[15px] bg-white p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <ShieldCheck className="size-3.5" aria-hidden /> Needs your confirmation
              </p>
              <p className="mt-1.5 text-sm font-medium text-ink-800">{a.summary}</p>
              {!a.state || a.state === "confirming" || a.state === "cancelling" ? (
                <div className="mt-3.5 flex gap-2">
                  <Button size="sm" loading={a.state === "confirming"} disabled={!!a.state} onClick={() => resolve(a, "confirm")} icon={<Check className="size-4" />}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="secondary" loading={a.state === "cancelling"} disabled={!!a.state} onClick={() => resolve(a, "cancel")} icon={<X className="size-4" />}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <p
                  className={cx(
                    "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    a.state === "done" ? "bg-emerald-50 text-emerald-700" : a.state === "failed" ? "bg-rose-50 text-rose-700" : "bg-ink-100 text-ink-600",
                  )}
                >
                  {a.state === "done" ? "✓ Done" : a.state === "cancelled" ? "Cancelled — nothing was changed" : `Couldn’t complete: ${a.result}`}
                </p>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-end gap-2" role="status" aria-label="The assistant is thinking">
            <span className="grid size-7 place-items-center rounded-full bg-accent-gradient text-white" aria-hidden><Sparkles className="size-3.5" /></span>
            <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 shadow-soft ring-1 ring-ink-200/70" aria-hidden>
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-accent-400" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="px-4 pb-2"><ErrorNote message={error} /></div>}

      <form onSubmit={onSubmit} className="border-t border-ink-200/70 bg-white/80 p-3 backdrop-blur">
        <div className="flex items-end gap-2 rounded-2xl bg-white p-1.5 shadow-soft ring-1 ring-ink-200 transition focus-within:ring-2 focus-within:ring-accent-400/60">
          <label htmlFor="assistant-input" className="sr-only">Message the assistant</label>
          <textarea
            id="assistant-input"
            rows={1}
            maxLength={1500}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask anything about your bookings…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <IconButton label="New conversation" onClick={newChat} icon={<RotateCcw className="size-4" />} />
          <IconButton label="Send message" type="submit" tone="brand" loading={sending} disabled={!input.trim()} icon={<Send className="size-4" />} />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-400">The assistant can make mistakes — every change needs your confirmation.</p>
      </form>
    </div>
  );
}
