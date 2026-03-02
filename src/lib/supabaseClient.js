import { createClient } from '@supabase/supabase-js';

const cleanEnv = (value) => (typeof value === 'string' ? value.trim() : '');

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
const SUPABASE_DISABLED_REASON = 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.';

const createDisabledError = (operation) => {
  const error = new Error(`[supabase] ${operation} unavailable. ${SUPABASE_DISABLED_REASON}`);
  error.code = 'SUPABASE_DISABLED';
  return error;
};

const createDisabledQuery = () => {
  const result = Promise.resolve({
    data: null,
    error: createDisabledError('database query'),
  });

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return result.then.bind(result);
        if (prop === 'catch') return result.catch.bind(result);
        if (prop === 'finally') return result.finally.bind(result);
        return () => createDisabledQuery();
      },
    },
  );
};

const createDisabledChannel = () => {
  const subscription = { unsubscribe: () => {} };
  return {
    on: () => createDisabledChannel(),
    subscribe: () => subscription,
    unsubscribe: () => {},
  };
};

const createDisabledSupabaseClient = () => {
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
      error: null,
    }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: createDisabledError('signInWithPassword'),
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: createDisabledError('signUp'),
    }),
    updateUser: async () => ({
      data: { user: null },
      error: createDisabledError('updateUser'),
    }),
    signOut: async () => ({ error: null }),
  };

  const base = {
    auth,
    from: () => createDisabledQuery(),
    rpc: () => createDisabledQuery(),
    channel: () => createDisabledChannel(),
    removeChannel: () => {},
    removeAllChannels: () => {},
  };

  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => createDisabledQuery();
    },
  });
};

if (!hasSupabaseEnv && import.meta.env.DEV) {
  console.warn(`[supabase] ${SUPABASE_DISABLED_REASON} Running with a disabled dev client.`);
}

if (!hasSupabaseEnv && !import.meta.env.DEV) {
  throw new Error(`${SUPABASE_DISABLED_REASON} Add them to your environment and rebuild.`);
}

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createDisabledSupabaseClient();

export default supabase;
