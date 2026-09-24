import type { Role } from "@prisma/client";
import {
  BarChart3, BookOpen, Bot, CalendarClock, CalendarPlus, ClipboardList, LayoutDashboard, MessageCircle,
  ScrollText, Settings, Star, Tags, Users, Wallet,
} from "lucide-react";

// Navigation per role. Hiding a link is UX only — every page and API route
// enforces the role on the server as well.

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const NAV: Record<Role, NavItem[]> = {
  CLIENT: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/book", label: "Book", icon: CalendarPlus },
    { href: "/bookings", label: "My bookings", icon: ClipboardList },
    { href: "/assistant", label: "Assistant", icon: Bot },
    { href: "/account", label: "Account", icon: Settings },
  ],
  PROVIDER: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/bookings", label: "Bookings", icon: ClipboardList },
    { href: "/provider/services", label: "Services & prices", icon: Tags },
    { href: "/provider/availability", label: "Availability", icon: CalendarClock },
    { href: "/feedback", label: "Feedback", icon: Star },
    { href: "/inbox", label: "WhatsApp", icon: MessageCircle },
    { href: "/earnings", label: "Earnings", icon: Wallet },
    { href: "/assistant", label: "Assistant", icon: Bot },
    { href: "/account", label: "Account", icon: Settings },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Overview", icon: BarChart3 },
    { href: "/bookings", label: "Bookings", icon: ClipboardList },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/catalog", label: "Catalogue", icon: BookOpen },
    { href: "/feedback", label: "Feedback", icon: Star },
    { href: "/inbox", label: "WhatsApp", icon: MessageCircle },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { href: "/admin/ai", label: "AI activity", icon: Bot },
    { href: "/assistant", label: "Assistant", icon: Bot },
    { href: "/account", label: "Account", icon: Settings },
  ],
};
