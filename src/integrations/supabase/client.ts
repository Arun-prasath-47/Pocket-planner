import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createMockSupabase, getMockUserByEmail } from './mock-client';

function isNewSupabaseApiKey(value: string): boolean { return value.startsWith('sb_publishable_'); }
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) headers.delete('Authorization');
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
function hasSupabaseConfig(): boolean {
  const url = import.meta.env['VITE_SUPABASE_URL'] || '';
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '';
  return Boolean(url && !url.includes('placeholder.supabase.co') && key && key !== 'placeholder-key');
}
export function isUsingMockClient(): boolean {
  if (hasSupabaseConfig()) return false;
  return import.meta.env.DEV || import.meta.env['VITE_ENABLE_DEMO_MODE'] === 'true';
}
export function emailHasAccount(email: string): boolean | null { if (!isUsingMockClient()) return null; return Boolean(getMockUserByEmail(email)); }
export function mockUserName(email: string): string | null { if (!isUsingMockClient()) return null; return getMockUserByEmail(email)?.user_metadata?.full_name || null; }
function createSupabaseClient() {
  const url = import.meta.env['VITE_SUPABASE_URL'] || '';
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '';
  if (isUsingMockClient()) return createMockSupabase() as unknown as ReturnType<typeof createClient<Database>>;
  if (!hasSupabaseConfig()) throw new Error('Pocket Planner is not configured. Set the Supabase production environment variables.');
  return createClient<Database>(url, key, { global: { fetch: createSupabaseFetch(key) }, auth: { storage: typeof window !== 'undefined' ? localStorage : undefined, persistSession: true, autoRefreshToken: true } });
}
let instance: ReturnType<typeof createSupabaseClient> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, { get(_, prop, receiver) { if (!instance) instance = createSupabaseClient(); return Reflect.get(instance, prop, receiver); } });
