import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as listUsers, POST as createUserRoute } from "@/app/api/admin/users/route";
import { PATCH as updateUser } from "@/app/api/admin/users/[id]/route";
import { GET as me } from "@/app/api/auth/me/route";
import { GET as ownServices, PUT as putOwnService } from "@/app/api/provider/services/route";
import { POST as createCategory } from "@/app/api/catalog/categories/route";
import { GET as search } from "@/app/api/catalog/search/route";
import { createUser } from "../helpers/db";
import { providerWithService } from "../helpers/fixtures";
import { call } from "../helpers/http";

const patchUser = (token: string, id: string, body: unknown) =>
  call<{ id: string }>(updateUser, `/api/admin/users/${id}`, { method: "PATCH", body, token, params: { id } });

describe("admin user management", () => {
  it("non-admins are refused", async () => {
    for (const role of ["CLIENT", "PROVIDER"] as const) {
      const u = await createUser(role);
      expect((await call(listUsers, "/api/admin/users", { token: u.token })).status).toBe(403);
    }
  });

  it("changing a role applies immediately and revokes the user's sessions", async () => {
    const admin = await createUser("ADMIN");
    const target = await createUser("CLIENT");
    const res = await patchUser(admin.token, target.user.id, { role: "PROVIDER" });
    expect(res.body.role).toBe("PROVIDER");
    expect((await call(me, "/api/auth/me", { token: target.token })).status).toBe(401);
    const audit = await prisma.auditEvent.findFirst({ where: { action: "user.role_change", entityId: target.user.id } });
    expect(audit?.actorId).toBe(admin.user.id);
  });

  it("an admin can't lock themselves out, and the last admin can't be removed", async () => {
    const admin = await createUser("ADMIN");
    expect((await patchUser(admin.token, admin.user.id, { role: "CLIENT" })).status).toBe(422);
    expect((await patchUser(admin.token, admin.user.id, { isActive: false })).status).toBe(422);
  });

  it("created accounts get a set-password link; the admin never handles the password", async () => {
    const admin = await createUser("ADMIN");
    const res = await call(createUserRoute, "/api/admin/users", {
      body: { email: "newpro@example.com", firstName: "Sipho", lastName: "Dube", role: "PROVIDER" },
      token: admin.token,
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("PROVIDER");
    expect(await prisma.passwordResetToken.count({ where: { userId: res.body.id } })).toBe(1);
    // Rejects a password field outright.
    const withPw = await call(createUserRoute, "/api/admin/users", {
      body: { email: "x@example.com", firstName: "A", lastName: "B", role: "CLIENT", password: "hunter2hunter2" },
      token: admin.token,
    });
    expect(withPw.status).toBe(422);
  });
});

describe("provider pricing", () => {
  it("providers manage only their own prices; a providerId in the body is rejected", async () => {
    const { provider, sub } = await providerWithService();
    const other = await providerWithService();
    const body = { subServiceId: sub.id, pricingType: "FIXED", rateCents: 30000, durationMin: 45 };

    expect((await call(putOwnService, "/api/provider/services", { method: "PUT", body, token: provider.token })).status).toBe(200);
    const sneaky = await call(putOwnService, "/api/provider/services", {
      method: "PUT", body: { ...body, providerId: other.provider.user.id }, token: provider.token,
    });
    expect(sneaky.status).toBe(422);

    const mine = await call(ownServices, "/api/provider/services", { token: provider.token });
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0]).toMatchObject({ rateCents: 30000, durationMin: 45 });
    const theirs = await prisma.providerService.findFirstOrThrow({ where: { providerId: other.provider.user.id } });
    expect(theirs.rateCents).toBe(25000);
  });

  it("clients can't set prices", async () => {
    const client = await createUser("CLIENT");
    const res = await call(putOwnService, "/api/provider/services", {
      method: "PUT", body: { subServiceId: "abc", pricingType: "FIXED", rateCents: 1, durationMin: 30 }, token: client.token,
    });
    expect(res.status).toBe(403);
  });
});

describe("catalog", () => {
  it("anyone can search; only admins can create categories", async () => {
    const { sub } = await providerWithService();
    const res = await call(search, "/api/catalog/search", { query: { q: "hair" } });
    expect(res.status).toBe(200);
    expect(res.body.data.find((s: { id: string }) => s.id === sub.id)).toMatchObject({ name: "Haircut", fromPriceCents: 25000 });

    const provider = await createUser("PROVIDER");
    expect((await call(createCategory, "/api/catalog/categories", { body: { name: "Nails" }, token: provider.token })).status).toBe(403);
    const admin = await createUser("ADMIN");
    expect((await call(createCategory, "/api/catalog/categories", { body: { name: "Nails" }, token: admin.token })).status).toBe(201);
  });
});
