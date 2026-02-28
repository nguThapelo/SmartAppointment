import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const fallbackUrl = 'http://localhost:54321';
const fallbackAnonKey =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYiLCJyb2xlIjoiYW5vbiJ9.signature';

export const supabase = createClient(
	supabaseUrl || fallbackUrl,
	supabaseAnonKey || fallbackAnonKey
);
