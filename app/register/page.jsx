'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/api.js';

export default function RegisterPage() {
  const router = useRouter();
  const [form,    setForm]    = useState({ email: '', password: '', confirm: '' });
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  { data: { role: 'client' } },
    });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] px-8 pt-10 pb-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Bot size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Create Account</h1>
            <p className="text-white/70 text-sm mt-1">Get started with WhatsApp Bot Admin</p>
          </div>

          <div className="px-8 py-8">
            {done ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bot size={28} className="text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Check your email</h3>
                <p className="text-sm text-gray-500 mt-2">
                  We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account, then sign in.
                </p>
                <a href="/login" className="btn-primary inline-flex mt-6 justify-center">
                  Go to Sign In
                </a>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                    <input type="email" className="input" placeholder="you@example.com"
                      value={form.email} onChange={set('email')} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                    <div className="relative">
                      <input type={show ? 'text' : 'password'} className="input pr-10"
                        placeholder="Min. 8 characters" value={form.password} onChange={set('password')} required minLength={8} />
                      <button type="button" onClick={() => setShow((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <input type={show ? 'text' : 'password'} className="input"
                      placeholder="Repeat your password" value={form.confirm} onChange={set('confirm')} required />
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full btn-primary justify-center py-3 text-base mt-2">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                    {loading ? 'Creating account…' : 'Create Account'}
                  </button>
                </form>

                <p className="text-center mt-5 text-sm text-gray-500">
                  Already have an account?{' '}
                  <a href="/login" className="text-whatsapp-dark hover:underline font-medium">Sign in</a>
                </p>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          SmartAppointment · WhatsApp Booking Bot
        </p>
      </div>
    </div>
  );
}
