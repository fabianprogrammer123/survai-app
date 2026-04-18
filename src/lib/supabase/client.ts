import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // In production this is a fatal misconfiguration — the client bundle
    // was built without NEXT_PUBLIC_* baked in. Make the error loud.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Supabase client misconfigured in production: NEXT_PUBLIC_SUPABASE_URL ' +
        'or NEXT_PUBLIC_SUPABASE_ANON_KEY was not baked into the build. ' +
        'Check --build-env-vars on the Cloud Run deploy.'
      );
    }
    // Dev / SSR-without-env: quietly fall back so pages still render.
    if (typeof window !== 'undefined') {
      console.error('[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    }
    return createBrowserClient('http://localhost:54321', 'placeholder-key');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
