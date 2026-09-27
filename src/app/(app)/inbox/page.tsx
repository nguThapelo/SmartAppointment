import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { requirePageUser } from "@/server/auth/page";
import { isConfigured } from "@/server/env";
import { Inbox } from "./Inbox";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function InboxPage() {
  const user = await requirePageUser(["PROVIDER", "ADMIN"], "/inbox");
  if (!isConfigured.whatsapp()) {
    return (
      <>
        <PageHeader title="WhatsApp" description="Customers book, check and change appointments by messaging your number." />
        <Card>
          <EmptyState icon={<MessageCircle className="size-10" />} title="WhatsApp booking is coming soon">
            Customers will be able to book, move and cancel appointments right from a WhatsApp chat — same rules, same calendar.
          </EmptyState>
        </Card>
      </>
    );
  }
  return <Inbox isAdmin={user.role === "ADMIN"} />;
}
