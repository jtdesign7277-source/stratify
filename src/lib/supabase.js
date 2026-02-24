import { createClient } from '@supabase/supabase-js';

const cleanEnv = (value) => (typeof value === 'string' ? value.trim() : '');

export const VITE_SUPABASE_URL = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
export const VITE_SUPABASE_ANON_KEY = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const hasSupabaseEnv = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY);

if (!hasSupabaseEnv && import.meta.env.DEV) {
  console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
}

export const supabase = hasSupabaseEnv
  ? createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  : null;

export default supabase;
