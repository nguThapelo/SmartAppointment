import type { ModelProvider, ModelRequest, ModelResponse } from "./types";

// Last resort when no model is configured or every provider failed. This is
// the original app's keyword assistant, kept as a safe fallback: it never
// calls tools, so it can't take actions or read data.

function reply(message: string): string {
  const m = message.toLowerCase();
  if (/(availab|slot|free|open)/.test(m)) {
    return "You can see real-time availability by choosing a service, then a provider, then a date on the Book page.";
  }
  if (/(book|appointment|reserve)/.test(m)) {
    return "To book: pick a service → provider → date and time on the Book page, then confirm. You'll get a reference like SA-ABC123.";
  }
  if (/(pay|payment|invoice)/.test(m)) {
    return "When your provider requests payment you'll see a Pay button on the booking. Payment status updates automatically once Stripe confirms it.";
  }
  if (/(cancel|reschedul|move)/.test(m)) {
    return "Open the booking from My bookings to cancel or pick a new time.";
  }
  return "The assistant is in limited mode right now. I can explain booking, availability, payments and cancellations — or use the menus to manage your bookings directly.";
}

export const ruleBasedProvider: ModelProvider = {
  name: "rules",
  async generate(req: ModelRequest): Promise<ModelResponse> {
    const last = [...req.turns].reverse().find((t) => t.role === "user");
    return { text: reply(last && last.role === "user" ? last.text : ""), toolCalls: [], usage: { input: 0, output: 0 } };
  },
};
