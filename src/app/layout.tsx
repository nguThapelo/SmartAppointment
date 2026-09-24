import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SmartAppointment", template: "%s · SmartAppointment" },
  description: "Book, manage and get paid for appointments — on the web, on WhatsApp, or by asking the AI assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
