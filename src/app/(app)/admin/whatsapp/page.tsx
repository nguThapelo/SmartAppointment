import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { env } from "@/server/env";
import { WhatsAppChannels } from "./WhatsAppChannels";

export const metadata: Metadata = { title: "WhatsApp channels" };

export default async function WhatsAppChannelsPage() {
  await requirePageUser(["ADMIN"], "/admin/whatsapp");
  return <WhatsAppChannels webhookUrl={`${env().APP_URL}/api/webhooks/whatsapp`} />;
}
