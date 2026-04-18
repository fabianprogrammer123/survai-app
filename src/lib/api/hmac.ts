import crypto from 'node:crypto';

/**
 * Verify an ElevenLabs post-call webhook signature.
 *
 * Header format:  `t=<unix_ts_seconds>,v0=<hex_hmac_sha256>`
 * Signed payload: `<unix_ts_seconds>.<raw_request_body>`
 * Algorithm:      HMAC-SHA256, secret = ELEVENLABS_WEBHOOK_SECRET.
 *
 * Returns true iff the header is present, well-formed, within the
 * tolerance window, and matches the expected digest. Comparison uses
 * `timingSafeEqual` to avoid leaking the signature via timing.
 *
 * The tolerance window (default 30 minutes) blunts replay attacks: a
 * forged request can't be accepted indefinitely even if an attacker
 * captures a valid signed body.
 */
export function verifyElevenLabsSignature({
  signatureHeader,
  rawBody,
  secret,
  toleranceSeconds = 30 * 60,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  signatureHeader: string | null | undefined;
  rawBody: string;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  if (!signatureHeader || !secret) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(',')) {
    const idx = segment.indexOf('=');
    if (idx <= 0) continue;
    const k = segment.slice(0, idx).trim();
    const v = segment.slice(idx + 1).trim();
    if (k) parts[k] = v;
  }

  const ts = parts.t;
  const sig = parts.v0;
  if (!ts || !sig) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(nowSeconds - tsNum) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');

  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
