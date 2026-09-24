import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { setStorageGatewayForTests, type StorageGateway } from "@/lib/s3";
import { GET as getFeedback, POST as submit } from "@/app/api/bookings/[id]/feedback/route";
import { GET as listSets, POST as createSet } from "@/app/api/feedback/sets/route";
import { POST as addQuestion } from "@/app/api/feedback/sets/[id]/questions/route";
import { GET as responses } from "@/app/api/feedback/responses/route";
import { GET as getMessages, POST as postMessage } from "@/app/api/bookings/[id]/messages/route";
import { GET as listFiles, POST as requestUpload } from "@/app/api/bookings/[id]/files/route";
import { POST as confirm } from "@/app/api/files/[id]/confirm/route";
import { GET as download } from "@/app/api/files/[id]/download/route";
import { createUser } from "../helpers/db";
import { insertBooking, providerWithService } from "../helpers/fixtures";
import { call } from "../helpers/http";

async function completedBooking() {
  const { ps, provider } = await providerWithService();
  const client = await createUser("CLIENT");
  const booking = await insertBooking({
    providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
    startsAt: new Date(Date.now() - 2 * 86400_000), status: "COMPLETED",
  });
  return { provider, client, booking };
}

async function questionSet(token: string, questions: Record<string, unknown>[]) {
  const set = await call(createSet, "/api/feedback/sets", { body: { title: `Set ${randomUUID().slice(0, 4)}` }, token });
  const ids: string[] = [];
  for (const q of questions) {
    const r = await call<{ id: string }>(addQuestion, `/api/feedback/sets/${set.body.id}/questions`, {
      body: q, token, params: { id: set.body.id },
    });
    ids.push(r.body.id);
  }
  return { setId: set.body.id as string, ids };
}

const submitAs = (token: string, id: string, answers: unknown[]) =>
  call<{ id: string }>(submit, `/api/bookings/${id}/feedback`, {
    body: { answers }, token, params: { id }, headers: { "idempotency-key": randomUUID() },
  });

describe("feedback", () => {
  it("a client answers the global + their provider's questions once; booking closes", async () => {
    const admin = await createUser("ADMIN");
    const { provider, client, booking } = await completedBooking();
    const global = await questionSet(admin.token, [{ text: "How was it overall?", answerType: "RATING_1_5" }]);
    const custom = await questionSet(provider.token, [{ text: "Would you come back?", answerType: "YES_NO" }]);

    const view = await call<{ id: string }>(getFeedback, `/api/bookings/${booking.id}/feedback`, { token: client.token, params: { id: booking.id } });
    expect(view.body.canSubmit).toBe(true);
    const ids = view.body.questions.map((q: { id: string }) => q.id);
    expect(ids).toEqual(expect.arrayContaining([global.ids[0], custom.ids[0]]));

    const ok = await submitAs(client.token, booking.id, [
      { questionId: global.ids[0], value: "5" },
      { questionId: custom.ids[0], value: "yes" },
    ]);
    expect(ok.status).toBe(201);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CLOSED");

    const again = await submitAs(client.token, booking.id, [{ questionId: global.ids[0], value: "1" }, { questionId: custom.ids[0], value: "no" }]);
    expect(again.status).toBe(422); // booking is CLOSED now; either way, no second response
    expect(await prisma.feedbackResponse.count({ where: { bookingId: booking.id } })).toBe(1);

    const provResponses = await call(responses, "/api/feedback/responses", { token: provider.token });
    expect(provResponses.body.averageRating).toBe(5);
  });

  it("[M-4] rejects answers to another provider's questions and invalid values", async () => {
    const { client, booking } = await completedBooking();
    const other = await providerWithService();
    const foreign = await questionSet(other.provider.token, [{ text: "Other provider's question", answerType: "TEXT" }]);
    const res = await submitAs(client.token, booking.id, [{ questionId: foreign.ids[0], value: "sneaky" }]);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INVALID_ANSWERS");

    const admin = await createUser("ADMIN");
    const g = await questionSet(admin.token, [{ text: "Rate us please", answerType: "RATING_1_5" }]);
    const bad = await submitAs(client.token, booking.id, [{ questionId: g.ids[0], value: "11" }]);
    expect(bad.status).toBe(422);
  });

  it("only the booking's client can submit, and only when completed", async () => {
    const { provider, booking } = await completedBooking();
    const stranger = await createUser("CLIENT");
    expect((await submitAs(stranger.token, booking.id, [{ questionId: "x", value: "5" }])).status).toBe(404);
    expect((await submitAs(provider.token, booking.id, [{ questionId: "x", value: "5" }])).status).toBe(403);

    const { ps, provider: p2 } = await providerWithService();
    const c2 = await createUser("CLIENT");
    const upcoming = await insertBooking({
      providerId: p2.user.id, clientId: c2.user.id, providerServiceId: ps.id,
      startsAt: new Date(Date.now() + 86400_000), status: "APPROVED",
    });
    const res = await submitAs(c2.token, upcoming.id, [{ questionId: "x", value: "5" }]);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("NOT_COMPLETED");
  });

  it("[M-5] providers can't see or edit another provider's private question set", async () => {
    const a = await providerWithService();
    const b = await providerWithService();
    const privateSet = await questionSet(a.provider.token, [{ text: "A's private question", answerType: "TEXT" }]);
    const visible = await call(listSets, "/api/feedback/sets", { token: b.provider.token });
    expect(visible.body.data.map((s: { id: string }) => s.id)).not.toContain(privateSet.setId);
    const edit = await call<{ id: string }>(addQuestion, `/api/feedback/sets/${privateSet.setId}/questions`, {
      body: { text: "Hijacked question", answerType: "TEXT" }, token: b.provider.token, params: { id: privateSet.setId },
    });
    expect(edit.status).toBe(404);
  });
});

describe("booking chat", () => {
  it("client and provider can talk; strangers and admins can't post", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const b = await insertBooking({
      providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
      startsAt: new Date(Date.now() + 86400_000), status: "APPROVED",
    });
    const post = (token: string, body: string) =>
      call<{ id: string }>(postMessage, `/api/bookings/${b.id}/messages`, { body: { body }, token, params: { id: b.id } });

    expect((await post(client.token, "Can I bring my own <b>shampoo</b>?")).status).toBe(201);
    expect((await post(provider.token, "Sure")).status).toBe(201);
    const stranger = await createUser("CLIENT");
    expect((await post(stranger.token, "hi")).status).toBe(404);
    const admin = await createUser("ADMIN");
    expect((await post(admin.token, "hi")).status).toBe(403);

    const read = await call<{ id: string }>(getMessages, `/api/bookings/${b.id}/messages`, { token: provider.token, params: { id: b.id } });
    expect(read.body.data).toHaveLength(2);
    expect(read.body.data[0].body).toBe("Can I bring my own <b>shampoo</b>?"); // stored verbatim, rendered as text by the UI
    expect(read.body.data[1].mine).toBe(true);
  });
});

describe("files", () => {
  const objects = new Map<string, { size: number; contentType: string }>();
  const fake: StorageGateway = {
    uploadUrl: async (key) => `https://s3.test/${key}?signed`,
    downloadUrl: async (key) => `https://s3.test/${key}?download`,
    head: async (key) => objects.get(key) ?? null,
  };
  beforeAll(() => setStorageGatewayForTests(fake));
  afterAll(() => setStorageGatewayForTests());

  it("upload → confirm → download, scoped to the booking's parties", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const b = await insertBooking({
      providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
      startsAt: new Date(Date.now() + 86400_000), status: "APPROVED",
    });

    const up = await call<{ id: string }>(requestUpload, `/api/bookings/${b.id}/files`, {
      body: { fileName: "../../etc/passwd.pdf", contentType: "application/pdf", size: 1234 },
      token: client.token, params: { id: b.id },
    });
    expect(up.status).toBe(201);
    const row = await prisma.fileAsset.findUniqueOrThrow({ where: { id: up.body.fileId } });
    expect(row.key).toMatch(new RegExp(`^bookings/${b.id}/[0-9a-f-]{36}$`)); // user file name never in the key

    // Confirm fails until the object actually exists with the approved size.
    expect((await call<{ id: string }>(confirm, `/api/files/${row.id}/confirm`, { method: "POST", token: client.token, params: { id: row.id } })).status).toBe(422);
    objects.set(row.key, { size: 1234, contentType: "application/pdf" });
    expect((await call<{ id: string }>(confirm, `/api/files/${row.id}/confirm`, { method: "POST", token: client.token, params: { id: row.id } })).status).toBe(200);

    const listed = await call<{ id: string }>(listFiles, `/api/bookings/${b.id}/files`, { token: provider.token, params: { id: b.id } });
    expect(listed.body.data).toHaveLength(1);
    expect((await call<{ id: string }>(download, `/api/files/${row.id}/download`, { token: provider.token, params: { id: row.id } })).status).toBe(200);

    const stranger = await createUser("CLIENT");
    expect((await call<{ id: string }>(download, `/api/files/${row.id}/download`, { token: stranger.token, params: { id: row.id } })).status).toBe(404);
  });

  it("rejects disallowed types and oversized files", async () => {
    const { ps, provider } = await providerWithService();
    const client = await createUser("CLIENT");
    const b = await insertBooking({
      providerId: provider.user.id, clientId: client.user.id, providerServiceId: ps.id,
      startsAt: new Date(Date.now() + 86400_000), status: "APPROVED",
    });
    const req = (body: unknown) => call<{ id: string }>(requestUpload, `/api/bookings/${b.id}/files`, { body, token: client.token, params: { id: b.id } });
    expect((await req({ fileName: "x.html", contentType: "text/html", size: 10 })).status).toBe(422);
    expect((await req({ fileName: "big.pdf", contentType: "application/pdf", size: 50 * 1024 * 1024 })).status).toBe(422);
  });
});
