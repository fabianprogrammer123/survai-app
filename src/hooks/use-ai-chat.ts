'use client';

import { useCallback, useState } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { executeCommands } from '@/lib/ai/command-executor';
import { getBlockTemplate } from '@/lib/templates/blocks';
import { nanoid } from 'nanoid';
import { addTrace, appendTraceEvent, updateTrace, type AITrace } from '@/lib/ai/trace';
import type { UiCommand } from '@/lib/ai/schema';
import type { ClarifyingQuestion, InsightCard, SurveyElement, SurveySettings, Proposal } from '@/types/survey';

/** Shorthand to get a monotonic-ish timestamp for trace events */
const now = () => performance.now();

interface UseAiChatOptions {
  endpoint?: string;
  /** SSE streaming endpoint (set to enable streaming). */
  streamEndpoint?: string;
}

/**
 * Parse an SSE stream, yielding {event, data} for each message.
 */
async function* parseSSE(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (data) {
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          // skip malformed data
        }
      }
    }
  }
}

/**
 * Build insight cards from elements + blockMap + blueprint.
 */
function buildInsightCards(
  elements: SurveyElement[],
  blockMap: Record<string, string>,
  blueprint?: { blocks?: Array<{ blockId: string; rationale?: string }> }
): InsightCard[] {
  const cards: InsightCard[] = [];
  for (const el of elements) {
    const blockId = blockMap[el.id];
    if (!blockId) continue;
    const block = getBlockTemplate(blockId);
    const blueprintBlock = blueprint?.blocks?.find(
      (b) => b.blockId === blockId
    );
    cards.push({
      elementId: el.id,
      blockId,
      blockLabel: block?.label || blockId,
      elementTitle: el.title || '',
      rationale: blueprintBlock?.rationale || '',
    });
  }
  return cards;
}

/**
 * Fire-and-forget background image generation.
 */
function generateBackgroundImage(prompt: string) {
  fetch('/api/ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.url) {
        useSurveyStore.getState().updateSettings({ backgroundImage: data.url });
      }
    })
    .catch((err) => {
      console.error('Background image generation failed:', err);
    });
}

export function useAiChat(options?: UseAiChatOptions) {
  const endpoint = options?.endpoint || '/api/ai/chat/test';
  const streamEndpoint = options?.streamEndpoint;
  const [statusText, setStatusText] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string, inputMethod: 'text' | 'voice' = 'text') => {
      const store = useSurveyStore.getState();

      // Prevent double-sends
      if (store.isChatLoading) return;

      // ── Create trace ──
      const traceId = nanoid();
      const traceStart = now();
      const activeEndpoint = store.editorMode === 'results'
        ? '/api/ai/results'
        : (streamEndpoint || endpoint);

      const trace: AITrace = {
        id: traceId,
        userMessage: text,
        inputMethod: inputMethod as 'text' | 'voice' | 'dictation',
        endpoint: activeEndpoint,
        events: [{ ts: now(), type: 'request_start', data: { text, inputMethod, editorMode: store.editorMode } }],
        hasError: false,
        startedAt: new Date().toISOString(),
      };
      addTrace(trace);

      // Add user message
      store.addChatMessage({
        id: nanoid(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        inputMethod,
      });
      store.setChatLoading(true);
      setStatusText(null);

      try {
        // Results mode — route to results AI endpoint
        if (store.editorMode === 'results') {
          await handleResultsRequest(text, traceId);
          return;
        }

        const history = store.chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const requestBody = JSON.stringify({
          // surveyId is consumed by the authenticated /api/ai/chat route; the
          // anonymous /test route ignores it. currentSurvey is the other way
          // around. Sending both means the same hook serves both endpoints.
          surveyId: store.survey.id,
          message: text,
          history,
          currentSurvey: {
            title: store.survey.title,
            description: store.survey.description,
            schema: store.survey.elements,
            settings: store.survey.settings,
            elementBlockMap: store.elementBlockMap,
          },
        });

        // Log context sent to AI
        appendTraceEvent(traceId, {
          ts: now(),
          type: 'system_prompt',
          data: {
            surveyTitle: store.survey.title,
            elementCount: store.survey.elements.length,
            historyLength: history.length,
          },
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);

        // Use streaming endpoint if available
        if (streamEndpoint) {
          await handleStreamingResponse(
            streamEndpoint,
            requestBody,
            controller.signal,
            setStatusText,
            traceId
          );
        } else {
          await handleStandardResponse(endpoint, requestBody, controller.signal, traceId);
        }

        clearTimeout(timeout);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
        const code = (error as Error & { code?: string })?.code;
        appendTraceEvent(traceId, { ts: now(), type: 'error', data: { error: errorMsg, code } });
        updateTrace(traceId, { hasError: true });

        // Schema / JSON-shape failures: the AI answered but in the wrong shape.
        // Surface an actionable message with a Retry that replays the last
        // user turn instead of the default "Something went wrong: ..." string.
        const isShapeFailure =
          code === 'ai_response_schema_mismatch' || code === 'ai_response_invalid_json';
        const content = isShapeFailure
          ? "The agent's reply didn't land. Want me to retry, or can you say more specifically what to change?"
          : `Something went wrong: ${errorMsg}`;

        useSurveyStore.getState().addChatMessage({
          id: nanoid(),
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          isError: true,
          retryText: isShapeFailure ? text : undefined,
        });
      } finally {
        updateTrace(traceId, { durationMs: Math.round(now() - traceStart) });
        useSurveyStore.getState().setChatLoading(false);
        setStatusText(null);
      }
    },
    [endpoint, streamEndpoint]
  );

  return { sendMessage, statusText };
}

// ---------------------------------------------------------------------------
// SSE streaming handler
// ---------------------------------------------------------------------------

async function handleStreamingResponse(
  url: string,
  body: string,
  signal: AbortSignal,
  setStatus: (text: string | null) => void,
  traceId?: string
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body,
  });

  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Request failed (${res.status})`);
  }

  // Track state for generate intent (streamed element-by-element)
  let genMeta: {
    message: string;
    blockMap: Record<string, string>;
    blueprint: unknown;
    allElements: SurveyElement[];
  } | null = null;

  // Stash for the server-emitted trace_id; arrives as the final SSE event.
  // When a non-generate result event arrives first, we need to attach the
  // traceId to that assistant message, so we cache the message id and patch
  // it once trace_id lands.
  let pendingTraceMessageId: string | null = null;
  let serverTraceId: string | null = null;

  for await (const { event, data } of parseSSE(res)) {
    const store = useSurveyStore.getState();

    switch (event) {
      case 'status':
        setStatus(data.text);
        if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'status', data: { text: data.text } });
        break;

      case 'result': {
        // Non-generate intents arrive as a single result event
        if (traceId) {
          appendTraceEvent(traceId, { ts: now(), type: 'intent_classified', data: { intent: data.intent, message: data.message } });
          appendTraceEvent(traceId, { ts: now(), type: 'ai_response_raw', data });
          updateTrace(traceId, { intent: data.intent as AITrace['intent'], assistantMessage: data.message as string });
        }
        const attachedId = handleNonGenerateResult(data, traceId);
        if (attachedId) {
          pendingTraceMessageId = attachedId;
          if (serverTraceId) patchMessageTraceId(attachedId, serverTraceId);
        }
        break;
      }

      case 'generation_start':
        // Clear canvas, set metadata, start streaming
        store.replaceElements([]);
        store.setTitle(data.title);
        store.setDescription(data.description);
        store.updateSettings(data.settings);
        store.setBlockMap(data.blockMap || {});
        store.setStreaming(true);
        setStatus(`Building ${data.totalElements} elements...`);
        genMeta = {
          message: data.message,
          blockMap: data.blockMap || {},
          blueprint: data.blueprint,
          allElements: [],
        };
        if (traceId) {
          appendTraceEvent(traceId, { ts: now(), type: 'intent_classified', data: { intent: 'generate' } });
          appendTraceEvent(traceId, { ts: now(), type: 'hydration', data: {
            title: data.title,
            totalElements: data.totalElements,
            blockMap: data.blockMap,
            blueprint: data.blueprint,
            settings: data.settings,
          }});
          updateTrace(traceId, { intent: 'generate', assistantMessage: data.message as string });
        }
        break;

      case 'element': {
        const element = data.element as SurveyElement | null | undefined;
        // Malformed payload — a missing/nullish element would otherwise
        // crash on element.id below. Drop it with a trace event so the
        // inspector surfaces the skip without losing the surrounding
        // generation. Root-cause fix lives in hydrate.ts + store.ts.
        if (!element || typeof element.id !== 'string' || typeof element.type !== 'string') {
          if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'error', data: { reason: 'dropped malformed element event', raw: data } });
          break;
        }
        store.addElement(element);
        store.addRecentlyAdded(element.id);
        if (genMeta) genMeta.allElements.push(element);
        setStatus(`Element ${data.index + 1} of ${data.total}`);
        if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'element_streamed', data: {
          index: data.index, total: data.total, type: element.type, title: element.title, blockId: genMeta?.blockMap[element.id],
        }});
        break;
      }

      case 'generation_complete': {
        store.setStreaming(false);
        setTimeout(() => useSurveyStore.getState().clearRecentlyAdded(), 1000);

        if (genMeta) {
          const insightCards = buildInsightCards(
            genMeta.allElements,
            genMeta.blockMap,
            genMeta.blueprint as Parameters<typeof buildInsightCards>[2]
          );

          const batchId = nanoid();
          const messageId = nanoid();

          store.addGenerationBatch({
            batchId,
            messageId,
            timestamp: new Date().toISOString(),
            elementIds: genMeta.allElements.map((e) => e.id),
            insightCards,
          });

          store.addChatMessage({
            id: messageId,
            role: 'assistant',
            content: genMeta.message,
            timestamp: new Date().toISOString(),
            generationBatchId: batchId,
          });

          // Remember this message id so the later trace_id event can attach to it.
          pendingTraceMessageId = messageId;
          if (serverTraceId) patchMessageTraceId(messageId, serverTraceId);

          // Background image
          const bgPrompt = useSurveyStore.getState().survey.settings.backgroundPrompt;
          if (bgPrompt) generateBackgroundImage(bgPrompt);
        }
        if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'generation_complete', data: {
          elementCount: genMeta?.allElements.length || 0,
          errors: data.errors,
        }});
        break;
      }

      case 'trace_id':
        // Final event from the server — the persisted ai_traces row id. Attach
        // it to the most-recent assistant message so the AI Inspector button
        // opens the right trace. Null = persist failed; leave the message as-is.
        serverTraceId = (data?.traceId as string | null) ?? null;
        if (serverTraceId && pendingTraceMessageId) {
          patchMessageTraceId(pendingTraceMessageId, serverTraceId);
        }
        break;

      case 'trace':
        // Server-side trace data (token usage, raw response, model info)
        if (traceId) {
          appendTraceEvent(traceId, { ts: now(), type: 'ai_response_raw', data: {
            model: data.model,
            systemPromptLength: data.systemPromptLength,
            rawResponse: data.rawResponse,
          }});
          if (data.tokenUsage) {
            updateTrace(traceId, { tokenUsage: data.tokenUsage });
          }
        }
        break;

      case 'error':
        if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'error', data: { error: data.error } });
        throw new Error(data.error);
    }
  }
}

// ---------------------------------------------------------------------------
// Standard (non-streaming) handler — fallback
// ---------------------------------------------------------------------------

async function handleStandardResponse(
  url: string,
  body: string,
  signal: AbortSignal,
  traceId?: string
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    const err = new Error(errBody.error || `Request failed (${res.status})`) as Error & { code?: string };
    if (typeof errBody.code === 'string') err.code = errBody.code;
    throw err;
  }

  const data = await res.json();
  const store = useSurveyStore.getState();

  if (traceId) {
    appendTraceEvent(traceId, { ts: now(), type: 'ai_response_raw', data });
    appendTraceEvent(traceId, { ts: now(), type: 'intent_classified', data: { intent: data.intent } });
    updateTrace(traceId, { intent: data.intent, assistantMessage: data.message });
  }

  if (data.intent === 'generate') {
    const { survey, blockMap, blueprint } = data;

    store.replaceElements([]);
    store.setTitle(survey.title);
    store.setDescription(survey.description);
    store.updateSettings(survey.settings);
    store.setBlockMap(blockMap || {});
    store.setStreaming(true);

    for (const element of survey.elements as SurveyElement[]) {
      await new Promise((r) => setTimeout(r, 150));
      store.addElement(element);
      store.addRecentlyAdded(element.id);
    }

    store.setStreaming(false);
    setTimeout(() => useSurveyStore.getState().clearRecentlyAdded(), 1000);

    const insightCards = buildInsightCards(
      survey.elements as SurveyElement[],
      blockMap || {},
      blueprint
    );

    const batchId = nanoid();
    const messageId = nanoid();

    store.addGenerationBatch({
      batchId,
      messageId,
      timestamp: new Date().toISOString(),
      elementIds: (survey.elements as SurveyElement[]).map((e: SurveyElement) => e.id),
      insightCards,
    });

    store.addChatMessage({
      id: messageId,
      role: 'assistant',
      content: data.message,
      timestamp: new Date().toISOString(),
      generationBatchId: batchId,
      traceId: typeof data.traceId === 'string' ? data.traceId : undefined,
    });

    const bgPrompt = survey.settings?.backgroundPrompt;
    if (bgPrompt) generateBackgroundImage(bgPrompt);
  } else {
    handleNonGenerateResult(data);
  }
}

// ---------------------------------------------------------------------------
// Shared handler for clarify, propose, command intents
// ---------------------------------------------------------------------------

/**
 * Patch an already-added chat message with a traceId. Immutable-safe via
 * setChatMessages because the store holds messages in an array.
 */
function patchMessageTraceId(messageId: string, traceId: string) {
  const store = useSurveyStore.getState();
  const next = store.chatMessages.map((m) =>
    m.id === messageId ? { ...m, traceId } : m
  );
  store.setChatMessages(next);
}

/**
 * Handles non-generate intents (clarify, propose, command) and returns the
 * id of the assistant message that was added, so the caller can later
 * attach a server-provided traceId to it. Returns null if no message was
 * added (e.g. command without narration).
 */
function handleNonGenerateResult(data: Record<string, unknown>, traceId?: string): string | null {
  const store = useSurveyStore.getState();

  if (data.intent === 'clarify') {
    const rawQuestions = (data.clarifyingQuestions as Array<string | ClarifyingQuestion>) || [];
    const clarifyingQuestions: ClarifyingQuestion[] = rawQuestions.map((q) =>
      typeof q === 'string' ? { question: q, response: q } : q
    );

    const id = nanoid();
    const traceIdFromServer = (data.traceId as string | undefined) ?? undefined;
    store.addChatMessage({
      id,
      role: 'assistant',
      content: data.message as string,
      timestamp: new Date().toISOString(),
      clarifyingQuestions,
      traceId: traceIdFromServer,
    });
    return id;
  } else if (data.intent === 'propose') {
    const proposals: Proposal[] = ((data.proposals as Array<Record<string, unknown>>) || []).map(
      (p) => ({
        label: p.label as string,
        description: p.description as string | undefined,
        elements: p.elements as SurveyElement[],
        settings: p.settings as SurveySettings,
        blockMap: (p.blockMap as Record<string, string>) || {},
      })
    );

    const id = nanoid();
    const traceIdFromServer = (data.traceId as string | undefined) ?? undefined;
    store.addChatMessage({
      id,
      role: 'assistant',
      content: data.message as string,
      timestamp: new Date().toISOString(),
      proposals,
      traceId: traceIdFromServer,
    });
    return id;
  } else if (data.intent === 'command') {
    const commands = (data.commands as UiCommand[]) || [];

    const publishCmd = commands.find((c) => c.action === 'publish_survey');
    const otherCommands = commands.filter((c) => c.action !== 'publish_survey');

    if (otherCommands.length > 0) {
      if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'command_executed', data: { commands: otherCommands } });
      executeCommands(otherCommands);
    }

    const id = nanoid();
    const traceIdFromServer = (data.traceId as string | undefined) ?? undefined;
    store.addChatMessage({
      id,
      role: 'assistant',
      content: data.message as string,
      timestamp: new Date().toISOString(),
      traceId: traceIdFromServer,
    });

    if (publishCmd) {
      if (traceId) appendTraceEvent(traceId, { ts: now(), type: 'publish_triggered', data: { respondentCount: publishCmd.respondentCount || 25 } });
      triggerPublish(publishCmd.respondentCount || 25);
    }

    return id;
  }
  return null;
}

/**
 * Handle a chat message when in results mode — calls the results AI endpoint.
 */
async function handleResultsRequest(text: string, traceId?: string) {
  const store = useSurveyStore.getState();

  // Track in results-specific history for API context
  store.addResultsChatMessage({
    id: `msg_${nanoid(8)}`,
    role: 'user',
    content: text,
    timestamp: new Date().toISOString(),
  });

  const resultHistory = useSurveyStore.getState().resultsChatMessages;

  const res = await fetch('/api/ai/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      elements: store.survey.elements,
      responses: store.responses,
      history: resultHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Failed to analyze results');
  }

  const data = await res.json();
  const s = useSurveyStore.getState();

  if (traceId) {
    appendTraceEvent(traceId, { ts: now(), type: 'results_query', data: {
      message: data.message,
      componentCount: data.a2uiMessages?.length || 0,
    }});
    updateTrace(traceId, { intent: null, assistantMessage: data.message });
  }

  // Add response to main chat
  s.addChatMessage({
    id: nanoid(),
    role: 'assistant',
    content: data.message,
    timestamp: new Date().toISOString(),
  });

  // Track in results history
  s.addResultsChatMessage({
    id: `msg_${nanoid(8)}`,
    role: 'assistant',
    content: data.message,
    timestamp: new Date().toISOString(),
  });

  // Update the A2UI dashboard
  if (data.a2uiMessages) {
    s.setA2UIMessages(data.a2uiMessages);
  }
}

/**
 * Trigger the mock-publish flow from a chat command.
 */
async function triggerPublish(count: number) {
  const store = useSurveyStore.getState();

  if (store.survey.elements.length === 0) {
    store.addChatMessage({
      id: nanoid(),
      role: 'assistant',
      content: 'Cannot publish — the survey has no questions yet. Add some questions first.',
      timestamp: new Date().toISOString(),
      isError: true,
    });
    return;
  }

  store.setGeneratingResponses(true);
  store.addChatMessage({
    id: nanoid(),
    role: 'assistant',
    content: `Publishing survey with ${count} AI-generated responses...`,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await fetch('/api/ai/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elements: store.survey.elements,
        count,
        title: store.survey.title,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate responses');
    }

    const data = await res.json();
    const s = useSurveyStore.getState();
    s.setResponses(data.responses);
    s.setPublished(true);
    s.setEditorMode('results');

    // Persist publish state to DB
    if (s.survey.id) {
      fetch(`/api/surveys/${s.survey.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicUrl: `${window.location.origin}/s/${s.survey.id}` }),
      }).catch(() => console.warn('Failed to persist publish state to DB'));
    }

    s.addChatMessage({
      id: nanoid(),
      role: 'assistant',
      content: `Survey published with ${count} responses. Switched to Results view — ask me anything about your data.`,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    useSurveyStore.getState().addChatMessage({
      id: nanoid(),
      role: 'assistant',
      content: `Failed to publish: ${e instanceof Error ? e.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
      isError: true,
    });
  } finally {
    useSurveyStore.getState().setGeneratingResponses(false);
  }
}
