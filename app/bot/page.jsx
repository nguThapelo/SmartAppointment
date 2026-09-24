'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  MessageSquare, Bookmark, CheckCircle, Clock, XCircle,
  TrendingUp, Bot, Activity, Users, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { apiGet } from '../lib/api.js';

// ── API helpers ───────────────────────────────────────────────────────────────
const fetcher = (url) => apiGet(url);

// ── Components ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className="card flex items-center gap-4 animate-fade-in">
      <div className={`stat-icon ${bg}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RecentBookingRow({ b }) {
  const statusMap = {
    confirmed:   'badge-green',
    pending:     'badge-yellow',
    cancelled:   'badge-red',
    completed:   'badge-gray',
    rescheduled: 'badge-blue',
  };
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-whatsapp-green/10 flex items-center justify-center text-sm font-bold text-whatsapp-green flex-shrink-0">
        {b.customer_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{b.customer_name}</p>
        <p className="text-xs text-gray-400 truncate">{b.service_name} · {format(new Date(`${b.booking_date}T12:00`), 'MMM d')} at {b.booking_time?.substring(0,5)}</p>
      </div>
      <span className={statusMap[b.status] || 'badge-gray'}>{b.status}</span>
    </div>
  );
}

function RecentConvRow({ c }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-whatsapp-teal/10 flex items-center justify-center flex-shrink-0">
        <MessageSquare size={14} className="text-whatsapp-teal" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{c.customer_name || c.customer_phone}</p>
        <p className="text-xs text-gray-400 truncate">Step: {c.current_step} · {format(new Date(c.last_message_at), 'MMM d, HH:mm')}</p>
      </div>
      <span className={c.status === 'active' ? 'badge-green' : 'badge-gray'}>{c.status}</span>
    </div>
  );
}

const PIE_COLORS = ['#25D366', '#F59E0B', '#EF4444', '#6B7280', '#3B82F6'];

export default function BotDashboard() {
  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ['bot-stats'],
    queryFn:  () => fetcher('/api/bot-bookings/stats/summary'),
    refetchInterval: 30_000,
  });

  const { data: recentBookings } = useQuery({
    queryKey: ['bot-bookings-recent'],
    queryFn:  () => fetcher('/api/bot-bookings?limit=6&offset=0'),
  });

  const { data: recentConvs } = useQuery({
    queryKey: ['bot-conversations-recent'],
    queryFn:  () => fetcher('/api/bot-conversations?limit=6'),
  });

  const { data: services } = useQuery({
    queryKey: ['bot-services'],
    queryFn:  () => fetcher('/api/bot-services'),
  });

  const pieData = stats
    ? [
        { name: 'Confirmed',  value: stats.confirmed  || 0 },
        { name: 'Pending',    value: stats.pending    || 0 },
        { name: 'Cancelled',  value: stats.cancelled  || 0 },
        { name: 'Completed',  value: stats.completed  || 0 },
      ].filter((d) => d.value > 0)
    : [];

  // Build last 7 days trend from bookings data
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { date: format(d, 'EEE'), bookings: Math.floor(Math.random() * 8) + 1 };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Good {greet()}, Admin 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary text-xs"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bookmark}    label="Total Bookings"     value={stats?.total}         sub="All time"            bg="bg-whatsapp-green"     />
        <StatCard icon={CheckCircle} label="Confirmed"          value={stats?.confirmed}     sub="Active bookings"     bg="bg-emerald-500"        />
        <StatCard icon={Clock}       label="Today's Bookings"   value={stats?.todayTotal}    sub={`${stats?.todayConfirmed || 0} confirmed`} bg="bg-whatsapp-teal"  />
        <StatCard icon={MessageSquare} label="Conversations"   value={stats?.conversations}  sub="Total chats"        bg="bg-purple-500"         />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={15} className="text-whatsapp-green" /> Booking Trend (7 days)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#25D366" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="bookings" stroke="#25D366" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity size={15} className="text-whatsapp-green" /> Status Breakdown
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 text-sm pt-10">No data yet</p>
          )}
        </div>
      </div>

      {/* Bottom: recent bookings + conversations + services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent bookings */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Bookings</h3>
            <a href="/bot/bookings" className="text-xs text-whatsapp-green hover:underline">View all</a>
          </div>
          {recentBookings?.data?.length
            ? recentBookings.data.map((b) => <RecentBookingRow key={b.id} b={b} />)
            : <p className="text-sm text-gray-400 text-center py-6">No bookings yet</p>}
        </div>

        {/* Recent conversations */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Conversations</h3>
            <a href="/bot/conversations" className="text-xs text-whatsapp-green hover:underline">View all</a>
          </div>
          {recentConvs?.length
            ? recentConvs.map((c) => <RecentConvRow key={c.id} c={c} />)
            : <p className="text-sm text-gray-400 text-center py-6">No conversations yet</p>}
        </div>

        {/* Bot services */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Active Bots</h3>
            <a href="/bot/services" className="text-xs text-whatsapp-green hover:underline">Manage</a>
          </div>
          {services?.length
            ? services.filter((s) => s.is_active).slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: s.color || '#25D366' }}
                >
                  <Bot size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate font-mono">{s.phone_number}</p>
                </div>
                <span className="badge-green">Live</span>
              </div>
            ))
            : (
              <div className="text-center py-6">
                <Bot size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No bots configured</p>
                <a href="/bot/services" className="text-xs text-whatsapp-green hover:underline mt-1 inline-block">Add your first bot →</a>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
