import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPageUser } from "@/server/auth/page";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  // Only same-site relative paths are allowed as a post-login destination (no open redirect).
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await getPageUser()) redirect(safeNext);
  return <LoginForm next={safeNext} expired={expired === "1"} />;
}
