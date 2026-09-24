import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { BookingsBrowser } from "./BookingsBrowser";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const user = await requirePageUser(undefined, "/bookings");
  return <BookingsBrowser role={user.role} tz={user.timezone} />;
}
