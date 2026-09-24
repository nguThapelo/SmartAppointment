import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { AccountSettings } from "./AccountSettings";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requirePageUser(undefined, "/account");
  return <AccountSettings name={`${user.firstName} ${user.lastName}`} email={user.email} role={user.role} />;
}
