// Static help content for the getPlatformHelp tool — facts the assistant can
// quote instead of improvising.

export const HELP_TOPICS = {
  booking:
    "Clients pick a service, a provider and a free time slot, then confirm. New bookings are PENDING until the provider approves them (WhatsApp channels may auto-approve). Each booking gets a reference like SA-7K3P9Q.",
  payments:
    "For online-paid services the provider requests payment after approving; the client gets a secure Stripe payment link. The booking becomes PAID only when Stripe confirms the payment. On-site services are paid in person. Refunds are handled by the business directly.",
  cancellations:
    "Clients can cancel a booking before it starts, unless it's already paid — then the provider must cancel it. Providers and admins must give a reason when cancelling or declining.",
  rescheduling:
    "Bookings can be moved to another free slot. If a client moves an already-approved booking, the provider has to approve the new time.",
  feedback:
    "After an appointment is completed, the client can answer the feedback questions once, from the booking page.",
  whatsapp:
    "Customers can also book, view, reschedule and cancel by WhatsApp. They only ever see bookings made from their own number.",
  account:
    "Change your password from Account settings. 'Sign out everywhere' ends every session on every device.",
} as const;
