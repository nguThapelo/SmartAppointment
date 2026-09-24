import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ErrorScreen";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <ErrorScreen
      code={404}
      title="This page wandered off"
      message="The page you're looking for doesn't exist or has moved."
      href="/"
      label="Go to home page"
      redirectSeconds={10}
    />
  );
}
