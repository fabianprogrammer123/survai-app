import Anthropic from '@anthropic-ai/sdk';

/**
 * Lazy-initialized Anthropic client. Do NOT instantiate at module load —
 * Next.js `next build` evaluates route modules during page-data collection,
 * and the Anthropic constructor throws if ANTHROPIC_API_KEY isn't set.
 * On Cloud Run the real key comes from Secret Manager at runtime.
 *
 * Usage inside a route handler:
 *   const anthropic = getAnthropic();
 *   const message = await anthropic.messages.create({...});
 */
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. In production it should be mounted from ' +
      'Secret Manager on the Cloud Run revision; locally it should be in .env.local.'
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Default model. Use Opus 4.7 for high-stakes reasoning (creator flow,
 * survey generation). Switch to `claude-haiku-4-5` for fast/cheap paths
 * (mock response generation, classification). Respondent voice agents
 * should use `claude-sonnet-4-6` for speed-quality balance.
 */
export const DEFAULT_MODEL = 'claude-opus-4-7';
export const FAST_MODEL = 'claude-haiku-4-5';
