/**
 * ElevenLabs API client for Conversational AI, phone calls, and TTS.
 *
 * Server-side only — uses ELEVENLABS_API_KEY from environment.
 */

import type {
  ElevenLabsAgentConfig,
  ElevenLabsAgent,
  OutboundCallRequest,
  OutboundCallResponse,
  BatchCallRequest,
  BatchCallResponse,
  ConversationDetails,
  PhoneNumber,
  SignedUrlResponse,
} from './types';

const BASE_URL = 'https://api.elevenlabs.io/v1';

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured');
  return key;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'xi-api-key': getApiKey(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs API error ${res.status}: ${body}`);
  }

  // Some endpoints (DELETE) return empty body
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ── Agents ──

export async function createAgent(
  config: ElevenLabsAgentConfig
): Promise<ElevenLabsAgent> {
  return apiRequest<ElevenLabsAgent>('/convai/agents/create', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function getAgent(agentId: string): Promise<ElevenLabsAgent> {
  return apiRequest<ElevenLabsAgent>(`/convai/agents/${agentId}`);
}

export async function updateAgent(
  agentId: string,
  config: Partial<ElevenLabsAgentConfig>
): Promise<ElevenLabsAgent> {
  return apiRequest<ElevenLabsAgent>(`/convai/agents/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

export async function deleteAgent(agentId: string): Promise<void> {
  await apiRequest(`/convai/agents/${agentId}`, { method: 'DELETE' });
}

// ── Signed URLs (for browser-based conversations) ──

export async function getSignedUrl(
  agentId: string
): Promise<SignedUrlResponse> {
  return apiRequest<SignedUrlResponse>(
    `/convai/conversation/get-signed-url?agent_id=${agentId}`
  );
}

// ── Phone Calls ──

export async function makeOutboundCall(
  request: OutboundCallRequest
): Promise<OutboundCallResponse> {
  return apiRequest<OutboundCallResponse>('/convai/twilio/outbound-call', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function submitBatchCalls(
  request: BatchCallRequest
): Promise<BatchCallResponse> {
  return apiRequest<BatchCallResponse>('/convai/batch-calling/submit', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getBatchCallStatus(
  batchId: string
): Promise<BatchCallResponse> {
  return apiRequest<BatchCallResponse>(`/convai/batch-calling/${batchId}`);
}

// ── Conversations ──

export async function getConversation(
  conversationId: string
): Promise<ConversationDetails> {
  return apiRequest<ConversationDetails>(
    `/convai/conversations/${conversationId}`
  );
}

// ── Phone Numbers ──

export async function listPhoneNumbers(): Promise<PhoneNumber[]> {
  const res = await apiRequest<{ phone_numbers: PhoneNumber[] }>(
    '/convai/phone-numbers'
  );
  return res.phone_numbers ?? [];
}

// ── Text-to-Speech ──

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George — warm, natural
const DEFAULT_TTS_MODEL = 'eleven_flash_v2_5'; // Fastest low-latency model

/**
 * Synthesize speech and return the full audio buffer.
 * Uses the streaming endpoint with optimize_streaming_latency for fastest first byte.
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<ArrayBuffer> {
  const res = await fetch(
    `${BASE_URL}/text-to-speech/${voiceId}?optimize_streaming_latency=4&output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_TTS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS error ${res.status}: ${body}`);
  }

  return res.arrayBuffer();
}

/**
 * Stream TTS audio — returns a ReadableStream for progressive playback.
 * Uses the /stream endpoint for lowest time-to-first-byte.
 */
export async function synthesizeSpeechStream(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<Response> {
  const res = await fetch(
    `${BASE_URL}/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_TTS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS stream error ${res.status}: ${body}`);
  }

  return res;
}

// ── Voices ──

export interface VoiceInfo {
  voice_id: string;
  name: string;
  category: string;
}

export async function listVoices(): Promise<VoiceInfo[]> {
  const res = await apiRequest<{ voices: VoiceInfo[] }>('/voices');
  return res.voices ?? [];
}
