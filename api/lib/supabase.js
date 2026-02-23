import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('[xray] Supabase server client env vars missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
}

const missingEnvError = () => {
  const error = new Error('Supabase server env vars missing: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  error.status = 500;
  throw error;
};

export const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      })
    : {
        from: missingEnvError,
      };

export default supabase;
