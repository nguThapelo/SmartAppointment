'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Plus, Pencil, Trash2, Copy, Check, ExternalLink,
  Phone, Power, PowerOff, ChevronDown, ChevronUp, X, Save,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api.js';

const COLORS = ['#25D366', '#128C7E', '#34B7F1', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];

const DEFAULT_FORM = {
  name: '', description: '', phone_number: '', twilio_account_sid: '',
  twilio_auth_token: '', welcome_message: '', booking_duration_minutes: 60,
  max_advance_days: 30, timezone: 'Africa/Johannesburg', color: '#25D366', is_active: true,
};

// ── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service, onEdit, onDelete, onToggle }) {
  const [copied, setCopied]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['bot-service-stats', service.id],
    queryFn:  () => apiGet(`/api/bot-services/${service.id}/stats`),
  });

  const { data: webhookInfo } = useQuery({
    queryKey: ['bot-webhook', service.id],
    queryFn:  () => apiGet(`/api/bot-services/${service.id}/webhook-url`),
  });

  function copyWebhook() {
    if (webhookInfo?.url) {
      navigator.clipboard.writeText(webhookInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="card hover:shadow-md transition-shadow animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: service.color || '#25D366' }}
        >
          <Bot size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900">{service.name}</h3>
            <span className={service.is_active ? 'badge-green' : 'badge-gray'}>
              {service.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{service.phone_number}</p>
          {service.description && (
            <p className="text-xs text-gray-400 mt-1 truncate">{service.description}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onToggle(service)} title={service.is_active ? 'Deactivate' : 'Activate'}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            {service.is_active ? <PowerOff size={15} /> : <Power size={15} />}
          </button>
          <button onClick={() => onEdit(service)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(service)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Conversations', value: stats?.totalConversations },
          { label: 'Bookings',      value: stats?.totalBookings },
          { label: 'Confirmed',     value: stats?.confirmedBookings },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-gray-900">{value ?? '…'}</p>
            <p className="text-[10px] text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Webhook URL */}
      <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-400 font-medium mb-0.5">TWILIO WEBHOOK URL</p>
          <p className="text-xs text-gray-600 font-mono truncate">
            {webhookInfo?.url || 'Loading…'}
          </p>
        </div>
        <button onClick={copyWebhook}
          className="p-1.5 rounded-md hover:bg-white text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors">
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Expand for details */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-center gap-1 mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Less details' : 'More details'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {[
            ['Slot duration',  `${service.booking_duration_minutes || 60} min`],
            ['Max advance',    `${service.max_advance_days || 30} days`],
            ['Timezone',       service.timezone || 'Africa/Johannesburg'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-gray-400">{k}</span>
              <span className="text-gray-700 font-medium">{v}</span>
            </div>
          ))}
          <div className="mt-2">
            <p className="text-[10px] text-gray-400 mb-1">WELCOME MESSAGE</p>
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 leading-relaxed">
              {service.welcome_message || 'Default welcome message'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Service Form Modal ────────────────────────────────────────────────────────

function ServiceModal({ service, onClose, onSaved }) {
  const [form, setForm]   = useState(service ? { ...DEFAULT_FORM, ...service } : { ...DEFAULT_FORM });
  const [error, setError] = useState('');
  const isEdit = !!service?.id;

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? apiPut(`/api/bot-services/${service.id}`, data) : apiPost('/api/bot-services', data),
    onSuccess: (data) => { onSaved(data); onClose(); },
    onError:   (err)  => setError(err.message),
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: form.color }}>
            <Bot size={16} className="text-white" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 flex-1">
            {isEdit ? 'Edit Bot Service' : 'Add New Bot Service'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          <Section title="Basic Info">
            <Field label="Service Name *">
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Hair Salon Bot" />
            </Field>
            <Field label="Description">
              <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Brief description" />
            </Field>
            <Field label="Brand Color">
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => set('color', c)}
                    className="w-7 h-7 rounded-lg ring-2 ring-offset-2 transition-all"
                    style={{ background: c, ringColor: form.color === c ? c : 'transparent' }}
                  />
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Twilio / WhatsApp">
            <Field label="WhatsApp Number (Bot ID) *" hint="Format: whatsapp:+14155238886">
              <input className="input font-mono text-sm" value={form.phone_number}
                onChange={(e) => set('phone_number', e.target.value)}
                placeholder="whatsapp:+14155238886" />
            </Field>
            <Field label="Twilio Account SID">
              <input className="input font-mono text-sm" value={form.twilio_account_sid}
                onChange={(e) => set('twilio_account_sid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </Field>
            <Field label="Twilio Auth Token">
              <input className="input font-mono text-sm" type="password" value={form.twilio_auth_token}
                onChange={(e) => set('twilio_auth_token', e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••" />
            </Field>
          </Section>

          <Section title="Booking Settings">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Slot Duration (min)">
                <input type="number" className="input" value={form.booking_duration_minutes}
                  onChange={(e) => set('booking_duration_minutes', Number(e.target.value))} min={15} step={15} />
              </Field>
              <Field label="Max Advance (days)">
                <input type="number" className="input" value={form.max_advance_days}
                  onChange={(e) => set('max_advance_days', Number(e.target.value))} min={1} max={365} />
              </Field>
            </div>
            <Field label="Timezone">
              <select className="input" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {[
                  'Africa/Johannesburg', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo',
                  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles',
                  'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney',
                ].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <Field label="Welcome Message">
              <textarea className="input resize-none" rows={3} value={form.welcome_message}
                onChange={(e) => set('welcome_message', e.target.value)}
                placeholder="Hello! 👋 Welcome to our booking service. How can I help you today?" />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name || !form.phone_number}
            className="btn-primary flex-1 justify-center"
          >
            <Save size={15} />
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Bot'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(null); // null | 'create' | service obj
  const [confirm, setConfirm] = useState(null); // service obj to delete

  const { data: services = [], isPending } = useQuery({
    queryKey: ['bot-services'],
    queryFn:  () => apiGet('/api/bot-services'),
  });

  const toggleMut = useMutation({
    mutationFn: (s) => apiPut(`/api/bot-services/${s.id}`, { is_active: !s.is_active }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['bot-services'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiDelete(`/api/bot-services/${id}`),
    onSuccess:  () => { setConfirm(null); qc.invalidateQueries({ queryKey: ['bot-services'] }); },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Bot Services</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Each service gets its own WhatsApp number (bot ID). Add services and configure their Twilio number.
          </p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">
          <Plus size={15} /> Add Bot Service
        </button>
      </div>

      {/* Twilio setup hint */}
      <div className="bg-whatsapp-green/5 border border-whatsapp-green/20 rounded-xl px-4 py-3 flex gap-3 items-start">
        <Phone size={16} className="text-whatsapp-green flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-gray-900">How to set up WhatsApp bots</p>
          <p className="text-gray-500 text-xs mt-0.5">
            1. Buy a WhatsApp-enabled number in <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-whatsapp-green hover:underline inline-flex items-center gap-0.5">Twilio Console <ExternalLink size={10} /></a>&nbsp;
            2. Add the service here and copy its Webhook URL&nbsp;
            3. Paste the URL into the phone number's Messaging webhook in Twilio
          </p>
        </div>
      </div>

      {/* Grid */}
      {isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-56">
              <div className="flex gap-3 mb-4">
                <div className="w-11 h-11 bg-gray-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-20">
          <Bot size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">No bot services yet</h3>
          <p className="text-sm text-gray-400 mt-1">Create your first WhatsApp bot to start accepting bookings</p>
          <button onClick={() => setModal('create')} className="btn-primary mt-4">
            <Plus size={15} /> Create First Bot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              onEdit={setModal}
              onDelete={setConfirm}
              onToggle={(svc) => toggleMut.mutate(svc)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <ServiceModal
          service={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['bot-services'] })}
        />
      )}

      {/* Delete Confirm */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete "{confirm.name}"?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will delete the bot service and all its conversations and bookings. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => deleteMut.mutate(confirm.id)}
                disabled={deleteMut.isPending}
                className="btn-danger flex-1 justify-center"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
