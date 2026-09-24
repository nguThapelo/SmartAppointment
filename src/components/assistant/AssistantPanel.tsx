"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Check, RotateCcw, Send, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNote, Spinner } from "@/components/ui/feedback";
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

const STORAGE_KEY = "sa.assistant.conversation";
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
    <div className={cx("flex min-h-0 flex-1 flex-col", !compact && "h-[calc(100vh-12rem)] rounded-2xl border border-ink-200 bg-white")}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={sending}>
        {messages.length === 0 && (
          <div className="space-y-3 py-6 text-center">
            <Bot className="mx-auto size-8 text-brand-600" aria-hidden />
            <p className="text-sm text-ink-600">Ask about services, availability or your bookings. I’ll ask you to confirm before changing anything.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cx(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                m.role === "user" ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-800",
              )}
            >
              {m.content}
            </p>
          </div>
        ))}

        {actions.map((a) => (
          <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <ShieldCheck className="size-3.5" aria-hidden /> Needs your confirmation
            </p>
            <p className="mt-1 text-sm text-ink-800">{a.summary}</p>
            {!a.state || a.state === "confirming" || a.state === "cancelling" ? (
              <div className="mt-3 flex gap-2">
                <Button size="sm" loading={a.state === "confirming"} disabled={!!a.state} onClick={() => resolve(a, "confirm")} icon={<Check className="size-4" />}>
                  Confirm
                </Button>
                <Button size="sm" variant="secondary" loading={a.state === "cancelling"} disabled={!!a.state} onClick={() => resolve(a, "cancel")} icon={<X className="size-4" />}>
                  Cancel
                </Button>
              </div>
            ) : (
              <p className={cx("mt-2 text-sm font-medium", a.state === "done" ? "text-emerald-700" : a.state === "failed" ? "text-red-700" : "text-ink-500")}>
                {a.state === "done" ? "✓ Done" : a.state === "cancelled" ? "Cancelled — nothing was changed." : `Couldn't complete: ${a.result}`}
              </p>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Spinner className="size-4" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="px-4"><ErrorNote message={error} /></div>}

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-ink-100 p-3">
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
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-ink-200 px-3 py-2 text-sm focus:border-brand-500"
        />
        <Button type="submit" loading={sending} disabled={!input.trim()} aria-label="Send" icon={<Send className="size-4" />} />
        <Button variant="ghost" onClick={newChat} aria-label="New conversation" title="New conversation" icon={<RotateCcw className="size-4" />} />
      </form>
    </div>
  );
}
