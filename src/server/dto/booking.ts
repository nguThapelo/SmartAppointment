import type { Booking, User } from "@prisma/client";
import { availableActions, type BookingAction, type Party } from "@/server/state/booking.machine";

type Person = Pick<User, "id" | "firstName" | "lastName" | "email" | "phone">;
export type BookingWithPeople = Booking & { provider: Person; client: Person | null };

export interface BookingDTO {
  id: string;
  reference: string;
  channel: Booking["channel"];
  status: Booking["status"];
  serviceName: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  currency: string;
  paymentMode: Booking["paymentMode"];
  notes: string | null;
  declineReason: string | null;
  cancelReason: string | null;
  provider: { id: string; name: string };
  /** Contact details are only included for the provider and admins. */
  customer: { name: string; email: string | null; phone: string | null };
  availableActions: BookingAction[];
  createdAt: string;
}

export function toBookingDTO(b: BookingWithPeople, party: Party): BookingDTO {
  const showContact = party === "provider" || party === "admin";
  const customerName = b.client ? `${b.client.firstName} ${b.client.lastName}` : (b.customerName ?? "Guest");
  return {
    id: b.id,
    reference: b.reference,
    channel: b.channel,
    status: b.status,
    serviceName: b.serviceName,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    priceCents: b.priceCents,
    currency: b.currency,
    paymentMode: b.paymentMode,
    notes: b.notes,
    declineReason: b.declineReason,
    cancelReason: b.cancelReason,
    provider: { id: b.provider.id, name: `${b.provider.firstName} ${b.provider.lastName}` },
    customer: {
      name: customerName,
      email: showContact ? (b.client?.email ?? b.customerEmail ?? null) : null,
      phone: showContact ? (b.client?.phone ?? b.customerPhone ?? null) : null,
    },
    availableActions: availableActions(b, party),
    createdAt: b.createdAt.toISOString(),
  };
}
