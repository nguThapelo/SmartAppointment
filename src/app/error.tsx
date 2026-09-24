"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Route-level error boundary. Shows the friendly page only — the error's
// message and stack are never rendered to users (audit M-7).
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      code={500}
      title="Something went wrong"
      message="That's on us. Please try again — if it keeps happening, come back in a little while."
      href="/dashboard"
      label="Back to dashboard"
      onRetry={reset}
    />
  );
}
