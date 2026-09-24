import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { BookingWizard } from "./BookingWizard";

export const metadata: Metadata = { title: "Book an appointment" };

export default async function BookPage() {
  const user = await requirePageUser(["CLIENT"], "/book");
  return <BookingWizard tz={user.timezone} />;
}
