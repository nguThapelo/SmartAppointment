import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Next.js 16 "proxy" (formerly middleware). This is a UX convenience only:
// it bounces visitors without a valid-looking session away from dashboard
// pages. It is NOT the security boundary — every API route and server page
// re-resolves the user and role from the database (src/server/auth).

const SESSION_COOKIE = "ah_session";
const PROTECTED_PREFIXES = [
  "/dashboard", "/book", "/bookings", "/provider", "/admin", "/inbox", "/feedback", "/earnings", "/assistant", "/account",
];

async function hasSignedSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!(await hasSignedSession(req))) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/book/:path*", "/bookings/:path*", "/provider/:path*", "/admin/:path*",
    "/inbox/:path*", "/feedback/:path*", "/earnings/:path*", "/assistant/:path*", "/account/:path*",
  ],
};
