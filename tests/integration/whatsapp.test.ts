import { createHmac, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setMessagingGatewayForTests } from "@/server/whatsapp/meta";
import { GET as verify, POST as webhook } from "@/app/api/webhooks/whatsapp/route";
import { GET as conversations } from "@/app/api/whatsapp/conversations/route";
import { POST as reply } from "@/app/api/whatsapp/conversations/[id]/reply/route";
import { createUser } from "../helpers/db";
import { providerWithService } from "../helpers/fixtures";
import { call } from "../helpers/http";

const sent: { to: string; body: string }[] = [];
beforeAll(() =>
  setMessagingGatewayForTests({
    async sendText(_id, to, body) {
      sent.push({ to, body });
      return { id: `wamid.out.${randomUUID()}` };
    },
  }),
);
afterAll(() => setMessagingGatewayForTests());
beforeEach(() => {
  sent.length = 0;
});

async function channelFixture(opts: { autoApprove?: boolean } = {}) {
  const f = await providerWithService();
  const phoneNumberId = String(Date.now()) + String(Math.floor(Math.random() * 1000));
  const channel = await prisma.whatsAppChannel.create({
    data: {
      providerId: f.provider.user.id, phoneNumberId, displayNumber: "+27 10 000 0000",
      name: "Test Salon", welcomeMessage: "Welcome to Test Salon!", autoApprove: opts.autoApprove ?? true,
    },
  });
  return { ...f, channel };
}

function payload(phoneNumberId: string, from: string, text: string, wamid = `wamid.in.${randomUUID()}`) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{
      id: "WABA",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "27100000000", phone_number_id: phoneNumberId },
          contacts: [{ wa_id: from, profile: { name: "Thandi" } }],
          messages: [{ from, id: wamid, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
        },
      }],
    }],
  });
}

const sign = (raw: string, secret = process.env.WHATSAPP_APP_SECRET!) =>
  `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

async function deliver(raw: string, signature: string | null = sign(raw)) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["x-hub-signature-256"] = signature;
  const res = await webhook(new NextRequest("http://localhost:3000/api/webhooks/whatsapp", { method: "POST", headers, body: raw }));
  return { status: res.status, body: await res.json() };
}

/** Send a message as `from` and return the bot's reply text. */
async function say(phoneNumberId: string, from: string, text: string) {
  const before = sent.length;
  const res = await deliver(payload(phoneNumberId, from, text));
  expect(res.status).toBe(200);
  return sent.slice(before).map((m) => m.body).join("\n");
}

async function bookThrough(phoneNumberId: string, from: string) {
  await say(phoneNumberId, from, "hi");
  await say(phoneNumberId, from, "1"); // book
  await say(phoneNumberId, from, "1"); // first service
  await say(phoneNumberId, from, "1"); // first date
  await say(phoneNumberId, from, "1"); // first time
  await say(phoneNumberId, from, "Thandi Nkosi");
  await say(phoneNumberId, from, "skip");
  return say(phoneNumberId, from, "YES");
}

describe("WhatsApp webhook security", () => {
  it("[H-5] rejects unsigned and forged deliveries without storing anything", async () => {
    const { channel } = await channelFixture();
    const raw = payload(channel.phoneNumberId, "27820000001", "hi");
    expect((await deliver(raw, null)).status).toBe(401);
    expect((await deliver(raw, sign(raw, "attacker-secret"))).status).toBe(401);
    expect(await prisma.whatsAppConversation.count({ where: { channelId: channel.id } })).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("verification handshake only answers with the right token", async () => {
    const q = (token: string) =>
      verify(new NextRequest(`http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc123`));
    expect(await (await q("test-verify-token")).text()).toBe("abc123");
    expect((await q("wrong")).status).toBe(401);
  });

  it("Meta retries (same wamid) are processed once", async () => {
    const { channel } = await channelFixture();
    const raw = payload(channel.phoneNumberId, "27820000002", "hi", "wamid.fixed.1");
    await deliver(raw);
    const again = await deliver(raw);
    expect(again.body.results).toEqual(["duplicate"]);
    expect(sent).toHaveLength(1);
  });

  it("ignores messages for numbers we don't manage", async () => {
    const res = await deliver(payload("999999999", "27820000003", "hi"));
    expect(res.body.results).toEqual(["ignored"]);
    expect(sent).toHaveLength(0);
  });
});

describe("WhatsApp booking conversation", () => {
  it("books end-to-end through the shared booking service", async () => {
    const { channel, provider } = await channelFixture();
    const menu = await say(channel.phoneNumberId, "27821110001", "hi");
    expect(menu).toContain("Welcome to Test Salon!");
    const confirmation = await bookThrough(channel.phoneNumberId, "27821110001");
    expect(confirmation).toMatch(/You're booked! Your reference is \*AH-[0-9A-Z]{6}\*/);

    const booking = await prisma.booking.findFirstOrThrow({ where: { whatsappChannelId: channel.id } });
    expect(booking).toMatchObject({
      channel: "WHATSAPP", status: "APPROVED", customerPhone: "+27821110001", customerName: "Thandi Nkosi",
      providerId: provider.user.id, priceCents: 25000, clientId: null,
    });
    const t = await prisma.bookingTransition.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } });
    expect(t.map((x) => [x.toStatus, x.actorType])).toEqual([["PENDING", "WHATSAPP"], ["APPROVED", "SYSTEM"]]);
  });

  it("without auto-approve the booking waits for the provider", async () => {
    const { channel } = await channelFixture({ autoApprove: false });
    expect(await bookThrough(channel.phoneNumberId, "27821110002")).toContain("Request sent!");
    expect((await prisma.booking.findFirstOrThrow({ where: { whatsappChannelId: channel.id } })).status).toBe("PENDING");
  });

  it("a customer only ever sees and cancels bookings from their own number", async () => {
    const { channel } = await channelFixture();
    await bookThrough(channel.phoneNumberId, "27821110003");

    await say(channel.phoneNumberId, "27829999999", "hi");
    expect(await say(channel.phoneNumberId, "27829999999", "2")).toContain("no upcoming bookings");
    await say(channel.phoneNumberId, "27829999999", "hi");
    expect(await say(channel.phoneNumberId, "27829999999", "4")).toContain("no upcoming bookings");

    await say(channel.phoneNumberId, "27821110003", "hi");
    expect(await say(channel.phoneNumberId, "27821110003", "4")).toContain("Which booking do you want to cancel?");
    await say(channel.phoneNumberId, "27821110003", "1");
    expect(await say(channel.phoneNumberId, "27821110003", "YES")).toContain("has been cancelled");
    expect((await prisma.booking.findFirstOrThrow({ where: { whatsappChannelId: channel.id } })).status).toBe("CANCELLED");
  });

  it("[H-6] two customers racing for one slot: the loser is offered fresh times", async () => {
    const { channel } = await channelFixture();
    const walk = async (from: string) => {
      for (const t of ["hi", "1", "1", "1", "1", "Customer Name", "skip"]) await say(channel.phoneNumberId, from, t);
    };
    await walk("27821110004");
    await walk("27821110005");
    expect(await say(channel.phoneNumberId, "27821110004", "YES")).toContain("You're booked!");
    const loser = await say(channel.phoneNumberId, "27821110005", "YES");
    expect(loser).toContain("that time was just taken");
    expect(await prisma.booking.count({ where: { whatsappChannelId: channel.id } })).toBe(1);
  });

  it("a corrupted conversation state resets safely to the menu", async () => {
    const { channel } = await channelFixture();
    await say(channel.phoneNumberId, "27821110006", "hi");
    await prisma.whatsAppConversation.updateMany({
      where: { channelId: channel.id },
      data: { step: "CONFIRM", session: { serviceId: "evil", startsAt: "2000-01-01", injected: "<script>" } },
    });
    const r = await say(channel.phoneNumberId, "27821110006", "YES");
    expect(r).toContain("What would you like to do?");
    expect(await prisma.booking.count({ where: { whatsappChannelId: channel.id } })).toBe(0);
  });
});

describe("WhatsApp dashboard access", () => {
  it("[H-8] providers see only their own channels' conversations; clients none", async () => {
    const a = await channelFixture();
    const b = await channelFixture();
    await say(a.channel.phoneNumberId, "27821110007", "hi");
    await say(b.channel.phoneNumberId, "27821110008", "hi");

    const mine = await call(conversations, "/api/whatsapp/conversations", { token: a.provider.token });
    expect(mine.body.data.map((c: { customerPhone: string }) => c.customerPhone)).toEqual(["+27821110007"]);
    const client = await createUser("CLIENT");
    expect((await call(conversations, "/api/whatsapp/conversations", { token: client.token })).status).toBe(403);

    const theirConversation = await prisma.whatsAppConversation.findFirstOrThrow({ where: { channelId: b.channel.id } });
    const res = await call<{ id: string }>(reply, `/api/whatsapp/conversations/${theirConversation.id}/reply`, {
      body: { body: "hello" }, token: a.provider.token, params: { id: theirConversation.id },
    });
    expect(res.status).toBe(404);
  });

  it("staff can't message a customer outside the 24h window", async () => {
    const { channel, provider } = await channelFixture();
    await say(channel.phoneNumberId, "27821110009", "hi");
    const conv = await prisma.whatsAppConversation.findFirstOrThrow({ where: { channelId: channel.id } });
    await prisma.whatsAppConversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date(Date.now() - 25 * 3600_000) } });
    const res = await call<{ id: string }>(reply, `/api/whatsapp/conversations/${conv.id}/reply`, {
      body: { body: "Special offer!" }, token: provider.token, params: { id: conv.id },
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("OUTSIDE_WINDOW");
  });
});
