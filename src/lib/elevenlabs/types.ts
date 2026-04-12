/**
 * ElevenLabs API types for Conversational AI, phone calls, and TTS.
 */

// ── Agent Configuration ──

export interface ElevenLabsAgentConfig {
  name: string;
  conversation_config: {
    agent: {
      first_message: string;
      language: string;
      prompt: {
        prompt: string;
        llm: string;
        temperature: number;
        tool_ids?: string[];
      };
    };
    tts?: {
      model_id?: string;
      voice_id: string;
      stability?: number;
      similarity_boost?: number;
      speed?: number;
      optimize_streaming_latency?: number;
    };
    turn?: {
      turn_timeout?: number;
      silence_end_call_timeout?: number;
      soft_timeout_config?: {
        timeout_seconds: number;
        message: string;
        use_llm_generated_message: boolean;
      };
      turn_eagerness?: 'eager' | 'normal' | 'patient';
    };
    conversation?: {
      max_duration_seconds?: number;
      client_events?: string[];
    };
  };
  platform_settings?: {
    data_collection?: Record<string, DataCollectionField>;
    evaluation_criteria?: Record<string, EvaluationCriterion>;
  };
}

export interface DataCollectionField {
  type: 'string' | 'boolean' | 'number' | 'enum';
  description: string;
}

export interface EvaluationCriterion {
  description: string;
}

export interface ElevenLabsAgent {
  agent_id: string;
  name: string;
  conversation_config: ElevenLabsAgentConfig['conversation_config'];
}

// ── Phone Calls ──

export interface OutboundCallRequest {
  agent_id: string;
  agent_phone_number_id: string;
  to_number: string;
  custom_llm_extra_body?: Record<string, unknown>;
}

export interface OutboundCallResponse {
  call_id: string;
  agent_id: string;
  status: string;
}

export interface BatchCallRequest {
  name: string;
  agent_id: string;
  agent_phone_number_id: string;
  recipients: BatchCallRecipient[];
  scheduled_time_unix?: number;
}

export interface BatchCallRecipient {
  phone_number: string;
  name?: string;
  [key: string]: string | undefined; // Dynamic variables for personalization
}

export interface BatchCallResponse {
  batch_call_id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  agent_id: string;
}

// ── Conversations ──

export interface ConversationDetails {
  conversation_id: string;
  agent_id: string;
  status: 'done' | 'processing' | 'failed';
  transcript: TranscriptEntry[];
  analysis?: {
    data_collection_results?: Record<string, DataCollectionResult>;
    evaluation_results?: Record<string, EvaluationResult>;
  };
  metadata?: {
    start_time_unix?: number;
    end_time_unix?: number;
    call_duration_secs?: number;
  };
}

export interface TranscriptEntry {
  role: 'agent' | 'user';
  message: string;
  time_in_call_secs: number;
}

export interface DataCollectionResult {
  value: string | boolean | number | null;
  rationale?: string;
}

export interface EvaluationResult {
  result: 'success' | 'failure' | 'unknown';
  rationale?: string;
}

// ── Webhooks ──

export interface WebhookTranscriptionPayload {
  type: 'post_call_transcription';
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    transcript: TranscriptEntry[];
    analysis: {
      data_collection_results: Record<string, DataCollectionResult>;
      evaluation_results: Record<string, EvaluationResult>;
    };
    metadata: {
      start_time_unix: number;
      end_time_unix: number;
      call_duration_secs: number;
      to_number?: string;
    };
  };
}

// ── Phone Numbers ──

export interface PhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label: string;
  assigned_agent_id?: string;
}

// ── TTS ──

export interface TTSRequest {
  text: string;
  voice_id?: string;
  model_id?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
  };
}

// ── Signed URL ──

export interface SignedUrlResponse {
  signed_url: string;
}

// ── Distribution ──

export type DistributionChannel = 'link' | 'email' | 'sms' | 'phone' | 'qr' | 'embed';
export type ResponseChannel = 'web_form' | 'web_voice' | 'phone_call';

export interface DistributionConfig {
  channels: DistributionChannel[];
  emailRecipients?: string[];
  phoneRecipients?: BatchCallRecipient[];
  scheduledTime?: string; // ISO string
}

export interface PublishedSurveyConfig {
  surveyId: string;
  agentId?: string;       // ElevenLabs agent ID
  phoneNumberId?: string; // ElevenLabs phone number ID for outbound calls
  publicUrl: string;
  distributionConfig: DistributionConfig;
  createdAt: string;
}

// ── Session Overrides (per-conversation personalization) ──

export interface ConversationOverrides {
  agent?: {
    prompt?: { prompt: string };
    firstMessage?: string;
    language?: string;
  };
  tts?: {
    voiceId?: string;
  };
  conversation?: {
    textOnly?: boolean;
  };
}
