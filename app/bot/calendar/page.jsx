'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Phone } from 'lucide-react';
import { apiGet } from '../../lib/api.js';

const STATUS_COLORS = {
  confirmed:   'bg-whatsapp-green text-white',
  pending:     'bg-yellow-400 text-white',
  cancelled:   'bg-red-400 text-white',
  completed:   'bg-gray-400 text-white',
  rescheduled: 'bg-blue-400 text-white',
};

// ── Calendar Grid ─────────────────────────────────────────────────────────────

function CalendarGrid({ month, bookings, onDayClick, selectedDay }) {
  const monthStart = startOfMonth(month);
  const monthEnd   = endOfMonth(month);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Build map: dateStr → bookings[]
  const byDay = {};
  (bookings || []).forEach((b) => {
    const key = b.booking_date;
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(b);
  });

  const HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="select-none">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {HEADERS.map((h) => (
          <div key={h} className="text-center text-xs font-semibold text-gray-400 py-2">{h}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
        {days.map((day) => {
          const key      = format(day, 'yyyy-MM-dd');
          const dayBooks = byDay[key] || [];
          const inMonth  = isSameMonth(day, month);
          const today    = isToday(day);
          const selected = selectedDay && isSameDay(day, selectedDay);

          return (
            <div
              key={key}
              onClick={() => inMonth && onDayClick(day, dayBooks)}
              className={[
                'bg-white min-h-[80px] md:min-h-[100px] p-1.5 cursor-pointer transition-colors',
                !inMonth   ? 'opacity-40 cursor-default' : 'hover:bg-gray-50',
                today      ? 'ring-2 ring-inset ring-whatsapp-green/40' : '',
                selected   ? 'bg-whatsapp-green/5' : '',
              ].join(' ')}
            >
              {/* Date number */}
              <div className={[
                'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full mb-1',
                today   ? 'bg-whatsapp-green text-white' : 'text-gray-700',
              ].join(' ')}>
                {format(day, 'd')}
              </div>

              {/* Booking pills */}
              <div className="space-y-0.5">
                {dayBooks.slice(0, 3).map((b, i) => (
                  <div key={i}
                    className={`truncate text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[b.status] || 'bg-gray-400 text-white'}`}>
                    {b.booking_time?.substring(0,5)} {b.customer_name?.split(' ')[0]}
                  </div>
                ))}
                {dayBooks.length > 3 && (
                  <div className="text-[10px] text-gray-400 pl-1">+{dayBooks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day Panel ─────────────────────────────────────────────────────────────────

function DayPanel({ day, bookings, onClose }) {
  const dateStr = format(day, 'EEEE, MMMM d');

  return (
    <div className="card animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays size={15} className="text-whatsapp-green" />
          {dateStr}
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge-green">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            ✕
          </button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No bookings on this day</p>
      ) : (
        <div className="space-y-3">
          {bookings
            .sort((a, b) => a.booking_time > b.booking_time ? 1 : -1)
            .map((b) => (
              <div key={b.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${b.status === 'confirmed' ? 'bg-whatsapp-green' : b.status === 'pending' ? 'bg-yellow-400' : b.status === 'cancelled' ? 'bg-red-400' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <p className="text-sm font-semibold text-gray-900">{b.customer_name}</p>
                    <span className="text-xs font-mono text-gray-400">{b.booking_time?.substring(0,5)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{b.service_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Phone size={10} />{b.customer_phone}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{b.duration_minutes} min</span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[b.status] || 'bg-gray-400 text-white'}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [month,       setMonth]       = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayBookings, setDayBookings] = useState([]);
  const [serviceId,   setServiceId]   = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['bot-services'],
    queryFn:  () => apiGet('/api/bot-services'),
  });

  const start = format(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const end   = format(endOfWeek(endOfMonth(month),     { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data, isPending } = useQuery({
    queryKey: ['calendar-bookings', start, end, serviceId],
    queryFn:  () => {
      const p = new URLSearchParams({ start, end });
      if (serviceId) p.set('serviceId', serviceId);
      return apiGet(`/api/bot-bookings/calendar?${p}`);
    },
  });

  const bookings = data?.bookings || [];

  function handleDayClick(day, books) {
    setSelectedDay(day);
    setDayBookings(books);
  }

  const monthBookings = bookings.filter(
    (b) => b.booking_date?.startsWith(format(month, 'yyyy-MM')),
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Calendar</h2>
          <p className="text-sm text-gray-500 mt-0.5">View all appointments month by month</p>
        </div>
        <select
          className="input text-sm py-1.5 w-44"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Month navigation + stats */}
      <div className="card py-3 px-4 flex items-center justify-between">
        <button onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
        <div className="text-center">
          <h3 className="text-base font-bold text-gray-900">{format(month, 'MMMM yyyy')}</h3>
          <p className="text-xs text-gray-400">{monthBookings.length} booking{monthBookings.length !== 1 ? 's' : ''} this month</p>
        </div>
        <button onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {[['Confirmed', 'bg-whatsapp-green'], ['Pending', 'bg-yellow-400'], ['Cancelled', 'bg-red-400'], ['Completed', 'bg-gray-400'], ['Rescheduled', 'bg-blue-400']].map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div>
        {isPending ? (
          <div className="h-96 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <CalendarGrid
            month={month}
            bookings={bookings}
            onDayClick={handleDayClick}
            selectedDay={selectedDay}
          />
        )}
      </div>

      {/* Day detail */}
      {selectedDay && (
        <DayPanel
          day={selectedDay}
          bookings={dayBookings}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Monthly summary */}
      {monthBookings.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">This Month — Quick Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {['confirmed', 'pending', 'rescheduled', 'cancelled', 'completed'].map((s) => {
              const count = monthBookings.filter((b) => b.status === s).length;
              return (
                <div key={s} className="text-center bg-gray-50 rounded-xl py-3">
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 capitalize">{s}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
