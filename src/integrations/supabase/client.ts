import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createMockSupabase, getMockUserByEmail } from './mock-client';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function isUsingMockClient(): boolean {
  const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || '';
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '';
  return (
    !SUPABASE_URL ||
    SUPABASE_URL.includes('placeholder.supabase.co') ||
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY === 'placeholder-key'
  );
}

// Account-aware sign-in helper (Google/Microsoft style "continue" step).
// In mock mode we can look the email up locally. In real mode we cannot
// safely enumerate users, so we return "unknown" and let the UI fall back
// to a combined sign-in / create-account decision.
export function emailHasAccount(email: string): boolean | null {
  if (!isUsingMockClient()) return null;
  return Boolean(getMockUserByEmail(email));
}

export function mockUserName(email: string): string | null {
  if (!isUsingMockClient()) return null;
  const user = getMockUserByEmail(email);
  return user?.user_metadata?.full_name || null;
}

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || '';
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '';

  const isPlaceholder = isUsingMockClient();

  if (isPlaceholder) {
    return createMockSupabase() as unknown as ReturnType<typeof createClient<Database>>;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

