import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

// Admin client — bypasses RLS, used for all server-side operations
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anon client — respects RLS, use when you want user-level access
export const supabase = createClient(supabaseUrl, anonKey);

export default supabaseAdmin;
