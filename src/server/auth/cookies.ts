import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "./session";

/** JSON response that also sets the session cookie. */
export function withSession(body: unknown, token: string, status = 200) {
  const res = NextResponse.json(body, { status });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

/** JSON response that clears the session cookie. */
export function withoutSession(body: unknown, status = 200) {
  const res = NextResponse.json(body, { status });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
