import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'SmartAppointment — WhatsApp Booking Bot',
  description: 'Manage your WhatsApp booking bot, conversations, and appointments in one place.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
