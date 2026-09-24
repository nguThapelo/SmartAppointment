import { SignJWT, jwtVerify } from "jose";

// Session token = signed JWT in an httpOnly cookie (briefcase pattern), extended
// for multiple users. It deliberately carries NO role: the role is re-read from
// the database on every request (see currentUser.ts), so a role change or
// deactivation takes effect immediately and a stale/forged claim can't grant
// access (audit C-1). `sv` is the user's sessionVersion; bumping it in the DB
// revokes every outstanding token for that user.

export const SESSION_COOKIE = "sa_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionClaims {
  sub: string;
  sv: number;
}

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ sv: claims.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    return { sub: payload.sub, sv: payload.sv };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
