import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

/**
 * Input shape for the server-side trace persist helper. Captures the minimum
 * we need in the AI Inspector: which model, which intent, how long, how many
 * tokens, and enough of the raw prompt + response to debug a bad turn.
 *
 * `surveyId` is nullable so the anonymous /test/edit flow (no Supabase survey
 * row) can still emit traces via the `Anon insert trace for test flow` RLS
 * policy. Authenticated flows set it to the survey being edited.
 */
export interface TracePayload {
  surveyId: string | null;
  turnIndex?: number;
  userMessage: string;
  intent: 'generate' | 'propose' | 'command' | 'clarify' | 'error' | 'results' | null;
  model: string | null;
  systemPrompt: string;
  durationMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  proposalsCount?: number | null;
  commands?: unknown;
  rawResponse?: string | null;
  error?: string | null;
}

/**
 * Persist a single trace row. Best-effort: never throws — if the insert
 * fails (RLS, network, bad payload) we log a warn and return null so the
 * route can still respond to the user. Trace loss is preferable to a broken
 * chat turn.
 *
 * Returns the inserted row id for the client to render / fetch, or null on
 * failure.
 */
export async function persistTrace(p: TracePayload): Promise<string | null> {
  try {
    const supabase = await createClient();
    const hash = createHash('sha256').update(p.systemPrompt).digest('hex').slice(0, 16);
    const head = p.systemPrompt.slice(0, 500);
    const rawSample = p.rawResponse ? p.rawResponse.slice(0, 2000) : null;

    const { data, error } = await supabase
      .from('ai_traces')
      .insert({
        survey_id: p.surveyId,
        turn_index: p.turnIndex ?? 0,
        user_message: p.userMessage,
        intent: p.intent,
        model: p.model,
        system_prompt_hash: hash,
        system_prompt_head: head,
        duration_ms: p.durationMs,
        input_tokens: p.inputTokens ?? null,
        output_tokens: p.outputTokens ?? null,
        proposals_count: p.proposalsCount ?? null,
        commands: p.commands ?? null,
        raw_response_sample: rawSample,
        error: p.error ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[ai/trace] persist failed:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn('[ai/trace] persist threw:', err);
    return null;
  }
}
