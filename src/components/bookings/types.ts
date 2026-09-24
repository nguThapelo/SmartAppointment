// Client-side views of API payloads (type-only imports; erased at build).
export type { BookingDTO } from "@/server/dto/booking";
export type { BookingAction } from "@/server/state/booking.machine";

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  data: T[];
}

export interface PaymentView {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  attempt: number;
  checkoutUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
}
