import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { sentInTests } from "@/server/services/email";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as logoutAll } from "@/app/api/auth/logout-all/route";
import { POST as forgot } from "@/app/api/auth/password/forgot/route";
import { POST as reset } from "@/app/api/auth/password/reset/route";
import { POST as change } from "@/app/api/auth/password/change/route";
import { createUser, TEST_PASSWORD } from "../helpers/db";
import { call, freshIp } from "../helpers/http";

const newUser = (email: string) => ({
  email,
  password: "a-strong-password",
  firstName: "Thandi",
  lastName: "Nkosi",
});

describe("registration", () => {
  it("creates a CLIENT and signs them in", async () => {
    const res = await call(register, "/api/auth/register", { body: newUser("New@Example.com"), ip: freshIp() });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "new@example.com", role: "CLIENT" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.sessionToken).toBeTruthy();
    expect(res.setCookie).toMatch(/HttpOnly/i);
  });

  it("[C-2] rejects a self-assigned role instead of honouring it", async () => {
    const res = await call(register, "/api/auth/register", {
      body: { ...newUser("sneaky@example.com"), role: "ADMIN" },
      ip: freshIp(),
    });
    expect(res.status).toBe(422);
    expect(await prisma.user.count({ where: { email: "sneaky@example.com" } })).toBe(0);
  });

  it("rejects duplicate emails regardless of case", async () => {
    const ip = freshIp();
    await call(register, "/api/auth/register", { body: newUser("dup@example.com"), ip });
    const res = await call(register, "/api/auth/register", { body: newUser("DUP@example.com"), ip });
    expect(res.status).toBe(409);
  });

  it("enforces a minimum password length", async () => {
    const res = await call(register, "/api/auth/register", {
      body: { ...newUser("weak@example.com"), password: "short" },
      ip: freshIp(),
    });
    expect(res.status).toBe(422);
  });
});

describe("login", () => {
  it("signs in with correct credentials", async () => {
    const { user } = await createUser("PROVIDER");
    const res = await call(login, "/api/auth/login", { body: { email: user.email, password: TEST_PASSWORD }, ip: freshIp() });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("PROVIDER");
    expect(res.sessionToken).toBeTruthy();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const { user } = await createUser();
    const wrong = await call(login, "/api/auth/login", { body: { email: user.email, password: "nope-nope-nope" }, ip: freshIp() });
    const unknown = await call(login, "/api/auth/login", { body: { email: "ghost@example.com", password: "nope-nope-nope" }, ip: freshIp() });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
    expect(wrong.body.code).toBe(unknown.body.code);
  });

  it("refuses deactivated accounts", async () => {
    const { user } = await createUser("CLIENT", { isActive: false });
    const res = await call(login, "/api/auth/login", { body: { email: user.email, password: TEST_PASSWORD }, ip: freshIp() });
    expect(res.status).toBe(401);
  });

  it("[M-8] rate-limits repeated attempts on one account even across IPs", async () => {
    const { user } = await createUser();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await call(login, "/api/auth/login", { body: { email: user.email, password: "wrong-password" }, ip: freshIp() })).status;
    }
    expect(last).toBe(429);
  });
});

describe("sessions and roles", () => {
  it("[C-1] takes the role from the database on every request, not from the token", async () => {
    const { user, token } = await createUser("CLIENT");
    expect((await call(me, "/api/auth/me", { token })).body.user.role).toBe("CLIENT");

    await prisma.user.update({ where: { id: user.id }, data: { role: "PROVIDER" } });
    // Same token, no re-login: the new role applies immediately.
    expect((await call(me, "/api/auth/me", { token })).body.user.role).toBe("PROVIDER");
  });

  it("rejects a token signed with a different secret", async () => {
    const { user } = await createUser("CLIENT");
    const forged = await new SignJWT({ sv: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("attacker-controlled-secret-attacker-controlled"));
    const res = await call(me, "/api/auth/me", { token: forged });
    expect(res.status).toBe(401);
  });

  it("rejects requests with no session", async () => {
    const res = await call(me, "/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SESSION_EXPIRED");
  });

  it("stops accepting a session once the user is deactivated", async () => {
    const { user, token } = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect((await call(me, "/api/auth/me", { token })).status).toBe(401);
  });

  it("logout-all revokes every existing token", async () => {
    const { token } = await createUser();
    const other = token; // e.g. the same account signed in on a second device
    expect((await call(logoutAll, "/api/auth/logout-all", { method: "POST", token })).status).toBe(200);
    expect((await call(me, "/api/auth/me", { token: other })).status).toBe(401);
  });

  it("[CSRF] blocks a state-changing request from another origin", async () => {
    const { token } = await createUser();
    const res = await call(logoutAll, "/api/auth/logout-all", { method: "POST", token, origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect((await call(me, "/api/auth/me", { token })).status).toBe(200);
  });
});

describe("password reset", () => {
  it("[H-9] answers identically for known and unknown emails", async () => {
    const { user } = await createUser();
    const known = await call(forgot, "/api/auth/password/forgot", { body: { email: user.email }, ip: freshIp() });
    const unknown = await call(forgot, "/api/auth/password/forgot", { body: { email: "nobody@example.com" }, ip: freshIp() });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("resets with a single-use link and revokes old sessions", async () => {
    const { user, token: oldToken } = await createUser();
    sentInTests.length = 0;
    await call(forgot, "/api/auth/password/forgot", { body: { email: user.email }, ip: freshIp() });
    const link = sentInTests.at(-1)!.text.match(/token=([^\s]+)/)![1]!;
    const resetToken = decodeURIComponent(link);

    const ok = await call(reset, "/api/auth/password/reset", { body: { token: resetToken, password: "brand-new-password" }, ip: freshIp() });
    expect(ok.status).toBe(200);

    const reused = await call(reset, "/api/auth/password/reset", { body: { token: resetToken, password: "another-password" }, ip: freshIp() });
    expect(reused.status).toBe(400);

    expect((await call(me, "/api/auth/me", { token: oldToken })).status).toBe(401);
    const relogin = await call(login, "/api/auth/login", { body: { email: user.email, password: "brand-new-password" }, ip: freshIp() });
    expect(relogin.status).toBe(200);
  });

  it("change password requires the current password and rotates the session", async () => {
    const { token } = await createUser();
    const bad = await call(change, "/api/auth/password/change", {
      body: { currentPassword: "not-my-password", newPassword: "whatever-new-pass" }, token,
    });
    expect(bad.status).toBe(400);

    const good = await call(change, "/api/auth/password/change", {
      body: { currentPassword: TEST_PASSWORD, newPassword: "whatever-new-pass" }, token,
    });
    expect(good.status).toBe(200);
    expect(good.sessionToken).toBeTruthy();
    expect((await call(me, "/api/auth/me", { token })).status).toBe(401);
    expect((await call(me, "/api/auth/me", { token: good.sessionToken! })).status).toBe(200);
  });
});
