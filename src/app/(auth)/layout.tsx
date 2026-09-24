import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}
