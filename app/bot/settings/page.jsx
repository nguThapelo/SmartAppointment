'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, Mail, Calendar, Plus, Trash2, Save, ChevronDown,
  AlertCircle, CheckCircle, Bot, Globe,
} from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '../../lib/api.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, '0');
  const m = String((i % 4) * 15).padStart(2, '0');
  return `${h}:${m}`;
});

// ── Business Hours Panel ──────────────────────────────────────────────────────

function BusinessHoursPanel({ serviceId }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState(null);
  const [saved, setSaved] = useState(false);

  const { isPending, data: hoursData } = useQuery({
    queryKey: ['business-hours', serviceId],
    queryFn:  () => apiGet(`/api/business-hours/${serviceId}`),
    enabled:  !!serviceId,
  });

  // Sync fetched data into local state when it arrives
  if (hoursData && !hours) setHours(hoursData);

  const mut = useMutation({
    mutationFn: (data) => apiPut(`/api/business-hours/${serviceId}`, { hours: data }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); qc.invalidateQueries({ queryKey: ['business-hours', serviceId] }); },
  });

  function toggle(idx) {
    setHours((prev) => prev.map((h, i) => i === idx ? { ...h, is_open: !h.is_open } : h));
  }

  function update(idx, field, value) {
    setHours((prev) => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  }

  if (isPending || !hours) {
    return <div className="space-y-3">{Array.from({ length: 7 }, (_, i) => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-2">
      {hours.map((h, idx) => (
        <div key={h.day_of_week}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${h.is_open ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
          <div className="w-24 flex-shrink-0">
            <p className="text-sm font-medium text-gray-900">{DAYS[h.day_of_week]}</p>
          </div>
          <label className="flex items-center cursor-pointer flex-shrink-0">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={h.is_open} onChange={() => toggle(idx)} />
              <div className={`w-9 h-5 rounded-full transition-colors ${h.is_open ? 'bg-whatsapp-green' : 'bg-gray-300'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.is_open ? 'translate-x-4' : ''}`} />
            </div>
          </label>
          {h.is_open && (
            <div className="flex items-center gap-2 flex-1">
              <select className="input text-xs py-1 w-24" value={h.open_time}
                onChange={(e) => update(idx, 'open_time', e.target.value)}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-gray-400 text-xs">to</span>
              <select className="input text-xs py-1 w-24" value={h.close_time}
                onChange={(e) => update(idx, 'close_time', e.target.value)}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input text-xs py-1 w-24" value={h.slot_duration_minutes}
                onChange={(e) => update(idx, 'slot_duration_minutes', Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() => mut.mutate(hours)}
        disabled={mut.isPending}
        className="btn-primary mt-2"
      >
        {saved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> {mut.isPending ? 'Saving…' : 'Save Hours'}</>}
      </button>
    </div>
  );
}

// ── Override Panel ────────────────────────────────────────────────────────────

function OverridesPanel({ serviceId }) {
  const qc = useQueryClient();
  const [date, setDate]     = useState('');
  const [closed, setClosed] = useState(true);
  const [open, setOpen]     = useState('09:00');
  const [close, setClose]   = useState('17:00');
  const [reason, setReason] = useState('');

  const { data: overrides = [] } = useQuery({
    queryKey: ['overrides', serviceId],
    queryFn:  () => apiGet(`/api/business-hours/${serviceId}/overrides`),
    enabled:  !!serviceId,
  });

  const addMut = useMutation({
    mutationFn: () => apiPost(`/api/business-hours/${serviceId}/overrides`, {
      override_date: date, is_closed: closed,
      open_time: closed ? null : open, close_time: closed ? null : close, reason,
    }),
    onSuccess: () => { setDate(''); setReason(''); qc.invalidateQueries({ queryKey: ['overrides', serviceId] }); },
  });

  const delMut = useMutation({
    mutationFn: (id) => apiDelete(`/api/business-hours/${serviceId}/overrides/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overrides', serviceId] }),
  });

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Date Override</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Date</label>
            <input type="date" className="input text-sm py-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Reason</label>
            <input className="input text-sm py-1.5" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Holiday, staff off…" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" className="rounded" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
            Closed all day
          </label>
          {!closed && (
            <>
              <select className="input text-xs py-1 w-24" value={open} onChange={(e) => setOpen(e.target.value)}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-gray-400 text-xs">to</span>
              <select className="input text-xs py-1 w-24" value={close} onChange={(e) => setClose(e.target.value)}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </>
          )}
        </div>
        <button onClick={() => addMut.mutate()} disabled={!date || addMut.isPending} className="btn-primary text-sm">
          <Plus size={14} /> {addMut.isPending ? 'Adding…' : 'Add Override'}
        </button>
      </div>

      {overrides.length > 0 && (
        <div className="space-y-2">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-900">{o.override_date}</p>
                <p className="text-xs text-gray-400">
                  {o.is_closed ? '🚫 Closed' : `⏰ ${o.open_time?.substring(0,5)} – ${o.close_time?.substring(0,5)}`}
                  {o.reason ? ` · ${o.reason}` : ''}
                </p>
              </div>
              <button onClick={() => delMut.mutate(o.id)} className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Email Config Panel ────────────────────────────────────────────────────────

function EmailPanel() {
  const fields = [
    { key: 'SMTP_HOST',       label: 'SMTP Host',       placeholder: 'smtp.gmail.com',   type: 'text' },
    { key: 'SMTP_PORT',       label: 'SMTP Port',       placeholder: '587',               type: 'number' },
    { key: 'SMTP_USER',       label: 'Username/Email',  placeholder: 'you@gmail.com',     type: 'email' },
    { key: 'SMTP_PASS',       label: 'Password/Token',  placeholder: '••••••••••••',      type: 'password' },
    { key: 'SMTP_FROM_NAME',  label: 'From Name',       placeholder: 'My Business',       type: 'text' },
    { key: 'SMTP_FROM_EMAIL', label: 'From Email',      placeholder: 'noreply@domain.com',type: 'email' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <AlertCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Email settings are configured in your <code className="bg-blue-100 px-1 rounded">.env.local</code> file.
          Restart the server after making changes.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            <div className="input flex items-center gap-2 bg-gray-50 text-gray-400 text-sm cursor-not-allowed">
              <code className="text-[10px] text-gray-400">{key}</code>
              <span className="text-gray-300">·</span>
              <span className="text-xs">{placeholder}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Google Calendar Panel ─────────────────────────────────────────────────────

function GoogleCalendarPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3">
        <AlertCircle size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-800">
          Google Calendar requires OAuth2 setup. Configure these keys in <code className="bg-yellow-100 px-1 rounded">.env.local</code>.
        </p>
      </div>
      <div className="space-y-3">
        {[
          ['GOOGLE_CLIENT_ID',     'OAuth2 Client ID from Google Cloud Console'],
          ['GOOGLE_CLIENT_SECRET', 'OAuth2 Client Secret'],
          ['GOOGLE_REFRESH_TOKEN', 'Long-lived refresh token from OAuth2 Playground'],
          ['GOOGLE_CALENDAR_ID',   'Calendar ID (use "primary" for your main calendar)'],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono font-semibold text-gray-700">{key}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-xs">
        <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
          className="btn-secondary text-xs">Google Cloud Console ↗</a>
        <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer"
          className="btn-secondary text-xs">OAuth2 Playground ↗</a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'hours',    label: 'Business Hours', icon: Clock },
  { id: 'overrides',label: 'Date Overrides', icon: Calendar },
  { id: 'email',    label: 'Email (SMTP)',   icon: Mail },
  { id: 'calendar', label: 'Google Calendar',icon: Globe },
];

export default function SettingsPage() {
  const [tab,       setTab]       = useState('hours');
  const [serviceId, setServiceId] = useState('');

  const { data: services = [] } = useQuery({
    queryKey: ['bot-services'],
    queryFn:  () => apiGet('/api/bot-services'),
  });

  // Auto-select first service once loaded
  if (services.length > 0 && !serviceId) setServiceId(services[0].id);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure business hours, emails, and integrations</p>
      </div>

      {/* Service selector (for hours / overrides) */}
      {['hours', 'overrides'].includes(tab) && (
        <div className="flex items-center gap-3">
          <Bot size={15} className="text-whatsapp-green flex-shrink-0" />
          <label className="text-sm font-medium text-gray-700 flex-shrink-0">Configure for:</label>
          <select
            className="input text-sm py-1.5 max-w-xs"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">— Select a bot service —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card">
        {tab === 'hours' && (
          serviceId
            ? <BusinessHoursPanel serviceId={serviceId} />
            : <p className="text-sm text-gray-400 text-center py-8">Select a bot service above to configure its hours</p>
        )}
        {tab === 'overrides' && (
          serviceId
            ? <OverridesPanel serviceId={serviceId} />
            : <p className="text-sm text-gray-400 text-center py-8">Select a bot service above to add date overrides</p>
        )}
        {tab === 'email'    && <EmailPanel />}
        {tab === 'calendar' && <GoogleCalendarPanel />}
      </div>
    </div>
  );
}
