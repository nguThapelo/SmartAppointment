'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/api.js';
import {
  LayoutDashboard, MessageSquare, CalendarDays, Settings,
  Bot, LogOut, Menu, X, ChevronRight, Bell, Bookmark,
  Zap, BarChart3, Clock,
} from 'lucide-react';

const NAV = [
  { href: '/bot',                label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/bot/services',       label: 'Bot Services',   icon: Bot },
  { href: '/bot/conversations',  label: 'Conversations',  icon: MessageSquare },
  { href: '/bot/bookings',       label: 'Bookings',       icon: Bookmark },
  { href: '/bot/calendar',       label: 'Calendar',       icon: CalendarDays },
  { href: '/bot/settings',       label: 'Settings',       icon: Settings },
];

function Sidebar({ open, onClose }) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed top-0 left-0 h-full w-64 z-40 flex flex-col',
          'bg-[#1b1f23] transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-whatsapp-green flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">SmartAppointment</p>
            <p className="text-gray-500 text-xs">WhatsApp Bot Admin</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto lg:hidden text-gray-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
            Main
          </p>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/bot' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`sidebar-link mb-1 ${active ? 'active' : ''}`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-whatsapp-green" />}
              </Link>
            );
          })}

          <div className="mt-6 mb-2">
            <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
              Quick Stats
            </p>
            <div className="mx-1 bg-white/5 rounded-xl p-3 space-y-2">
              <QuickStat icon={<Zap size={12} />}      label="Bot Active" value="Online" color="text-green-400" />
              <QuickStat icon={<BarChart3 size={12} />} label="Today"     value="…"    color="text-blue-400" />
              <QuickStat icon={<Clock size={12} />}     label="Pending"   value="…"    color="text-yellow-400" />
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/Login';
            }}
            className="sidebar-link w-full text-left mt-1"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function QuickStat({ icon, label, value, color }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5 text-gray-500">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

export default function BotLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Auth guard — redirect to existing login page if no active Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
    });
  }, []);

  const pageTitle = NAV.find(
    ({ href }) => pathname === href || (href !== '/bot' && pathname.startsWith(href)),
  )?.label || 'Bot Admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <Menu size={18} />
          </button>

          <h1 className="text-sm font-semibold text-gray-900">{pageTitle}</h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Bot Live
            </div>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 relative">
              <Bell size={16} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
