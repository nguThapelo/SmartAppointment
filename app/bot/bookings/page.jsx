'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search, Filter, CheckCircle, XCircle, RefreshCw, Clock,
  CalendarDays, Phone, Mail, Pencil, X, Save, ChevronDown,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../lib/api.js';

const STATUS_STYLES = {
  confirmed:   'badge-green',
  pending:     'badge-yellow',
  cancelled:   'badge-red',
  completed:   'badge-gray',
  rescheduled: 'badge-blue',
  no_show:     'badge-purple',
};

const STATUS_OPTIONS = ['pending','confirmed','rescheduled','completed','cancelled','no_show'];

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({ booking, onClose, onDone }) {
  const [date, setDate] = useState(booking.booking_date || '');
  const [time, setTime] = useState(booking.booking_time?.substring(0,5) || '');
  const [error, setError] = useState('');

  const { data: slots = [] } = useQuery({
    queryKey: ['slots', booking.bot_service_id, date],
    queryFn:  () => date ? apiGet(`/api/bot-bookings/slots?serviceId=${booking.bot_service_id}&date=${date}`).then(r => r.slots) : [],
    enabled:  !!date,
  });

  const mut = useMutation({
    mutationFn: () => apiPost(`/api/bot-bookings/${booking.id}/reschedule`, { newDate: date, newTime: time }),
    onSuccess: (data) => { onDone(data); onClose(); },
    onError:   (err)  => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <RefreshCw size={16} className="text-whatsapp-green" />
          <h3 className="font-semibold text-gray-900 flex-1">Reschedule Booking</h3>
          <button onClick={onClose}><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <p className="text-xs text-gray-500 mb-1">Current: <span className="font-medium">{format(new Date(`${booking.booking_date}T12:00`), 'MMM d')} at {booking.booking_time?.substring(0,5)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Date</label>
            <input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }}
              min={format(new Date(), 'yyyy-MM-dd')} />
          </div>
          {date && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Time</label>
              {slots.length === 0 ? (
                <p className="text-xs text-gray-400">No available slots on this date</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <button key={s} onClick={() => setTime(s)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${time === s ? 'bg-whatsapp-green text-white border-whatsapp-green' : 'border-gray-200 text-gray-700 hover:border-whatsapp-green'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !date || !time}
            className="btn-primary flex-1 justify-center">
            {mut.isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Booking Detail Drawer ─────────────────────────────────────────────────────

function BookingDrawer({ booking, onClose, onUpdated }) {
  const qc = useQueryClient();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(booking.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const statusMut = useMutation({
    mutationFn: (status) => apiPost(`/api/bot-bookings/${booking.id}/${status}`),
    onSuccess: (data) => { onUpdated(data); qc.invalidateQueries({ queryKey: ['bot-bookings'] }); },
  });

  async function saveNotes() {
    setSaving(true);
    try {
      const data = await apiPut(`/api/bot-bookings/${booking.id}`, { admin_notes: adminNotes });
      onUpdated(data);
    } finally { setSaving(false); }
  }

  const dateStr = format(new Date(`${booking.booking_date}T12:00`), 'EEEE, MMMM d, yyyy');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-up overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Booking Details</h3>
              <span className={STATUS_STYLES[booking.status] || 'badge-gray'}>{booking.status}</span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{booking.confirmation_code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Customer */}
          <Section title="Customer">
            <Row icon={<Phone size={13} />} label="Phone"   value={booking.customer_phone} />
            <Row icon={<Mail size={13} />}  label="Email"   value={booking.customer_email || 'Not provided'} />
            <Row icon={null}               label="Name"    value={booking.customer_name} />
          </Section>

          {/* Appointment */}
          <Section title="Appointment">
            <Row label="Service"  value={booking.service_name} />
            <Row icon={<CalendarDays size={13} />} label="Date" value={dateStr} />
            <Row icon={<Clock size={13} />} label="Time" value={`${booking.booking_time?.substring(0,5)} (${booking.duration_minutes} min)`} />
          </Section>

          {/* Admin notes */}
          <Section title="Admin Notes">
            <textarea
              className="input resize-none text-sm"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes…"
            />
            <button onClick={saveNotes} disabled={saving} className="btn-secondary text-xs mt-1">
              <Save size={12} /> {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </Section>

          {/* Actions */}
          <Section title="Actions">
            <div className="flex flex-wrap gap-2">
              {['pending', 'rescheduled'].includes(booking.status) && (
                <button onClick={() => statusMut.mutate('confirm')} disabled={statusMut.isPending}
                  className="btn-primary text-xs">
                  <CheckCircle size={13} /> Confirm
                </button>
              )}
              {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <button onClick={() => statusMut.mutate('complete')} disabled={statusMut.isPending}
                  className="btn-secondary text-xs">
                  <CheckCircle size={13} /> Mark Completed
                </button>
              )}
              {!['cancelled', 'completed'].includes(booking.status) && (
                <>
                  <button onClick={() => setRescheduleOpen(true)}
                    className="btn-secondary text-xs">
                    <RefreshCw size={13} /> Reschedule
                  </button>
                  <button onClick={() => statusMut.mutate('cancel')} disabled={statusMut.isPending}
                    className="btn-danger text-xs">
                    <XCircle size={13} /> Cancel
                  </button>
                </>
              )}
            </div>
          </Section>

          {/* Google Calendar */}
          {booking.google_event_id && (
            <Section title="Google Calendar">
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={12} /> Event synced to Google Calendar
              </p>
            </Section>
          )}
        </div>
      </div>

      {rescheduleOpen && (
        <RescheduleModal
          booking={booking}
          onClose={() => setRescheduleOpen(false)}
          onDone={(data) => { onUpdated(data); qc.invalidateQueries({ queryKey: ['bot-bookings'] }); }}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400 flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-gray-800 font-medium text-right max-w-[60%] truncate" title={value}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [serviceId, setServiceId] = useState('');
  const [dateFilter, setDate]   = useState('');
  const [selected, setSelected] = useState(null);
  const [page,     setPage]     = useState(0);
  const LIMIT = 20;

  const { data: services = [] } = useQuery({
    queryKey: ['bot-services'],
    queryFn:  () => apiGet('/api/bot-services'),
  });

  const { data, isPending, refetch } = useQuery({
    queryKey: ['bot-bookings', search, status, serviceId, dateFilter, page],
    queryFn:  () => {
      const p = new URLSearchParams();
      if (search)    p.set('search',    search);
      if (status)    p.set('status',    status);
      if (serviceId) p.set('serviceId', serviceId);
      if (dateFilter) p.set('date',    dateFilter);
      p.set('limit',  String(LIMIT));
      p.set('offset', String(page * LIMIT));
      return apiGet(`/api/bot-bookings?${p}`);
    },
  });

  const bookings = data?.data || [];
  const total    = data?.count || 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Bookings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage all WhatsApp bookings — confirm, reschedule or cancel</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-xs">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card py-3 px-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 text-sm py-1.5" placeholder="Search name, phone, code…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <select className="input text-sm py-1.5 w-36" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input text-sm py-1.5 w-40" value={serviceId}
            onChange={(e) => { setServiceId(e.target.value); setPage(0); }}>
            <option value="">All services</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="date" className="input text-sm py-1.5 w-36" value={dateFilter}
            onChange={(e) => { setDate(e.target.value); setPage(0); }} />
          {(search || status || serviceId || dateFilter) && (
            <button onClick={() => { setSearch(''); setStatus(''); setServiceId(''); setDate(''); setPage(0); }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Reference', 'Customer', 'Service', 'Date & Time', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                    No bookings found
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(b)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.confirmation_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{b.customer_name}</p>
                      <p className="text-xs text-gray-400">{b.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">{b.service_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-900">{format(new Date(`${b.booking_date}T12:00`), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-gray-400">{b.booking_time?.substring(0,5)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_STYLES[b.status] || 'badge-gray'}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-whatsapp-green hover:underline" onClick={(e) => { e.stopPropagation(); setSelected(b); }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * LIMIT >= total}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <BookingDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => setSelected(updated)}
        />
      )}
    </div>
  );
}
