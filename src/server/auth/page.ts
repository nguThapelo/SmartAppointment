import "server-only";
import type { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActor, type Actor } from "./currentUser";
import { SESSION_COOKIE } from "./session";

// Session helpers for server-rendered pages. Same resolution as the API
// (role from the DB every time); pages redirect instead of returning 401/403.
// The browser never decides access on its own — every API call is re-checked.

export async function getPageUser(): Promise<Actor | null> {
  const store = await cookies();
  return resolveActor(store.get(SESSION_COOKIE)?.value);
}

export async function requirePageUser(roles?: readonly Role[], next = "/dashboard"): Promise<Actor> {
  const user = await getPageUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}
