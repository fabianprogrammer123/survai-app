/**
 * Production env validation. Called at module load time from a server-only
 * entrypoint (src/proxy.ts) so a misconfigured Cloud Run revision crashes
 * on its first cold start with a clear error — not silently works until
 * the Nth user request finally tries to read the missing var.
 */

const REQUIRED_SERVER_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
] as const;

/**
 * Fail-loud if required env vars are missing in production.
 * No-op in development (where some vars might legitimately be unset
 * e.g. while onboarding).
 */
export function assertServerEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_SERVER_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    // Thrown error surfaces in Cloud Run revision logs as the startup failure.
    throw new Error(
      `Survai: missing required env vars in production: ${missing.join(', ')}. ` +
      `Check Secret Manager mappings on the Cloud Run service revision.`
    );
  }
}
