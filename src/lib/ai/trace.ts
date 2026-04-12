/**
 * AI interaction trace — captures the full lifecycle of each AI call
 * for admin observability and system improvement.
 */

export interface TraceEvent {
  /** Monotonic timestamp (ms since page load) for ordering */
  ts: number;
  type:
    | 'request_start'     // User sent a message
    | 'system_prompt'     // System prompt snapshot sent to AI
    | 'ai_response_raw'   // Raw JSON from OpenAI (before hydration)
    | 'intent_classified'  // What the AI decided to do
    | 'hydration'         // Blueprint → elements mapping
    | 'command_executed'   // UI mutation from command intent
    | 'element_streamed'   // Individual element delivered
    | 'generation_complete'
    | 'error'
    | 'status'            // Intermediate status update
    | 'tts_start'         // Voice synthesis triggered
    | 'tts_complete'
    | 'publish_triggered'
    | 'results_query';
  data: Record<string, unknown>;
}

export interface AITrace {
  id: string;
  /** User's original message */
  userMessage: string;
  /** Input method: text, voice, dictation */
  inputMethod: 'text' | 'voice' | 'dictation';
  /** Which endpoint was called */
  endpoint: string;
  /** AI intent classification */
  intent?: 'generate' | 'command' | 'clarify' | 'propose' | null;
  /** AI's response message shown to user */
  assistantMessage?: string;
  /** Timeline of events */
  events: TraceEvent[];
  /** Total duration (ms) */
  durationMs?: number;
  /** OpenAI token usage if available */
  tokenUsage?: { prompt: number; completion: number; total: number };
  /** Whether this interaction had errors */
  hasError: boolean;
  /** Timestamp */
  startedAt: string;
}

/**
 * In-memory trace buffer. Keeps the last N traces.
 * Exposed as a simple module-level API — no React dependency.
 */
const MAX_TRACES = 50;
const traces: AITrace[] = [];
const listeners = new Set<() => void>();

export function getTraces(): readonly AITrace[] {
  return traces;
}

export function addTrace(trace: AITrace) {
  traces.unshift(trace);
  if (traces.length > MAX_TRACES) traces.pop();
  listeners.forEach((fn) => fn());
}

export function updateTrace(id: string, update: Partial<AITrace>) {
  const trace = traces.find((t) => t.id === id);
  if (trace) {
    Object.assign(trace, update);
    listeners.forEach((fn) => fn());
  }
}

export function appendTraceEvent(id: string, event: TraceEvent) {
  const trace = traces.find((t) => t.id === id);
  if (trace) {
    trace.events.push(event);
    listeners.forEach((fn) => fn());
  }
}

export function clearTraces() {
  traces.length = 0;
  listeners.forEach((fn) => fn());
}

/** Subscribe to trace changes. Returns unsubscribe function. */
export function subscribeTraces(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
