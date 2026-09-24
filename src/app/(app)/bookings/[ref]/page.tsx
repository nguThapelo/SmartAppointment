import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { BookingDetail } from "./BookingDetail";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const user = await requirePageUser(undefined, `/bookings/${ref}`);
  return <BookingDetail reference={ref} role={user.role} tz={user.timezone} />;
}
