import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { UsersAdmin } from "./UsersAdmin";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requirePageUser(["ADMIN"], "/admin/users");
  return <UsersAdmin selfEmail={user.email} />;
}
