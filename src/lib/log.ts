/**
 * Structured JSON logger. One log line per event, single-line JSON, suitable
 * for stdout ingestion by Cloud Run / Cloud Logging / Vercel logs / pino-style
 * pipelines. No SDK dependency.
 *
 * Usage:
 *   import { log } from '@/lib/log';
 *   log.info({ event: 'survey.created', userId, surveyId });
 *   log.warn({ event: 'response.submit_failed', surveyId, reason: 'rls_denied' });
 *   log.error({ event: 'api.unhandled', err: e instanceof Error ? e.message : String(e) });
 *
 * Conventions:
 *   - `event` is a snake_case namespaced verb: `survey.created`, `auth.login_failed`.
 *   - Always include identifiers as separate fields (userId, surveyId), not interpolated.
 *   - Never log secrets, full session tokens, or full PII bodies.
 *   - Timing fields: `durationMs` (number), `startedAt` (ISO string).
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

function emit(level: Level, fields: Fields) {
  const line = {
    ts: new Date().toISOString(),
    level,
    ...fields,
  };
  // Single-line JSON to stdout (errors → stderr) so log pipelines can parse.
  const out = JSON.stringify(line);
  if (level === 'error' || level === 'warn') {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const log = {
  debug: (fields: Fields) => emit('debug', fields),
  info: (fields: Fields) => emit('info', fields),
  warn: (fields: Fields) => emit('warn', fields),
  error: (fields: Fields) => emit('error', fields),
};

/**
 * Wraps an async API handler with timing + outcome logging.
 * Use to instrument /api/** routes:
 *
 *   export const POST = withApiLog('surveys.create', async (req) => { ... });
 */
export function withApiLog<Args extends unknown[], R>(
  event: string,
  handler: (...args: Args) => Promise<R>
) {
  return async (...args: Args): Promise<R> => {
    const start = Date.now();
    try {
      const result = await handler(...args);
      const durationMs = Date.now() - start;
      // Best-effort status capture if result is a Response
      let status: number | undefined;
      if (result && typeof result === 'object' && 'status' in result) {
        status = (result as { status: number }).status;
      }
      log.info({ event, durationMs, status });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      log.error({
        event,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  };
}
