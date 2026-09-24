import type { Metadata } from "next";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="Assistant"
        description="Ask in plain language. It only sees what you can see, and it asks before changing anything."
      />
      <AssistantPanel />
    </>
  );
}
