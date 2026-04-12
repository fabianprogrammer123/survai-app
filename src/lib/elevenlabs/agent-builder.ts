/**
 * Converts a Survai survey definition into an ElevenLabs Conversational AI agent config.
 *
 * The agent conducts the survey conversationally — asking each question one at a time,
 * validating responses against allowed options, and capturing answers via Data Collection.
 *
 * Uses {{guest_name}} dynamic variable for per-session personalization.
 */

import type { SurveyElement, Survey } from '@/types/survey';
import type { ElevenLabsAgentConfig, DataCollectionField } from './types';

// ── System prompt generation ──

function describeElement(el: SurveyElement, index: number): string {
  const num = index + 1;
  const req = el.required ? ' (must answer)' : ' (can skip)';

  switch (el.type) {
    case 'short_text':
      return `${num}. "${el.title}"${req} — short answer`;

    case 'long_text':
      return `${num}. "${el.title}"${req} — open-ended, let them talk`;

    case 'multiple_choice':
      return `${num}. "${el.title}"${req} — pick one: ${el.options.join(', ')}${el.allowOther ? ' (or their own answer)' : ''}`;

    case 'checkboxes':
      return `${num}. "${el.title}"${req} — pick any: ${el.options.join(', ')}`;

    case 'dropdown':
      return `${num}. "${el.title}"${req} — one of: ${el.options.join(', ')}`;

    case 'linear_scale':
      return `${num}. "${el.title}"${req} — ${el.min} to ${el.max}${el.minLabel ? ` (${el.min}=${el.minLabel}` : ''}${el.maxLabel ? `, ${el.max}=${el.maxLabel})` : ')'}`;

    case 'date':
      return `${num}. "${el.title}"${req} — ask for a date`;

    case 'section_header':
      return `--- ${el.title} ---`;

    case 'page_break':
      return '';

    case 'file_upload':
      return `${num}. "${el.title}"${req} — ask them to describe it verbally`;

    default: {
      const _el = el as SurveyElement;
      return `${num}. "${_el.title}"${req}`;
    }
  }
}

function buildSystemPrompt(survey: Survey): string {
  const questionElements = survey.elements.filter(
    (el) => el.type !== 'page_break' && el.type !== 'section_header'
  );

  const questionsBlock = survey.elements
    .filter((el) => el && el.type !== 'page_break')
    .map((el, i) => describeElement(el, i))
    .filter(Boolean)
    .join('\n');

  return `You're a friendly assistant helping {{guest_name}} answer ${questionElements.length} quick question${questionElements.length !== 1 ? 's' : ''}.
${survey.description ? `\nContext: ${survey.description}\n` : ''}
## Style
- Text-message energy. Short. Warm. Like a friend asking.
- Max 1-2 sentences per turn. Never monologue.
- Natural reactions: "Nice.", "Got it.", "Love that."
- Don't repeat the question if they answered it.

## Questions
${questionsBlock}

## Rules
- One question at a time.
- Use their name once at start, then sparingly.
- Choice questions: say options naturally, don't number them.
- If they're vague on a required question, nudge once. Then move on.
- When done: thank them briefly, say bye. Keep it warm, keep it short.

# Guardrails
- Never make up answers. Only record what they actually said.
- Don't comment on their answers beyond brief acknowledgment.
- Stay on topic. If they drift, gently redirect.
- This step is important: always capture their answers in data collection fields.`;
}

function buildFirstMessage(survey: Survey): string {
  const questionCount = survey.elements.filter(
    (el) => !['section_header', 'page_break'].includes(el.type)
  ).length;

  if (questionCount <= 3) {
    return `Hey {{guest_name}}! Just ${questionCount} quick thing${questionCount !== 1 ? 's' : ''} I wanted to ask you. Ready?`;
  }

  return `Hey {{guest_name}}! Got ${questionCount} quick questions for you — couple minutes tops. Let's go?`;
}

// ── Data Collection fields ──

function buildDataCollection(
  elements: SurveyElement[]
): Record<string, DataCollectionField> {
  const fields: Record<string, DataCollectionField> = {};

  const questionElements = elements.filter(
    (el) => !['section_header', 'page_break'].includes(el.type)
  );

  for (const el of questionElements) {
    switch (el.type) {
      case 'short_text':
      case 'long_text':
        fields[el.id] = {
          type: 'string',
          description: `Answer to: "${el.title}". Capture their exact words.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'multiple_choice':
      case 'dropdown':
        fields[el.id] = {
          type: 'string',
          description: `Choice for: "${el.title}". One of: ${el.options.join(', ')}${el.type === 'multiple_choice' && 'allowOther' in el && el.allowOther ? ', or a custom answer' : ''}.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'checkboxes':
        fields[el.id] = {
          type: 'string',
          description: `Selections for: "${el.title}". Comma-separated from: ${el.options.join(', ')}.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'linear_scale':
        fields[el.id] = {
          type: 'number',
          description: `Rating for: "${el.title}". Number from ${el.min} to ${el.max}.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'date':
        fields[el.id] = {
          type: 'string',
          description: `Date for: "${el.title}". Format: YYYY-MM-DD.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'file_upload':
        fields[el.id] = {
          type: 'string',
          description: `For: "${el.title}" — capture verbal description or "skipped".`,
        };
        break;
    }
  }

  // Metadata fields
  fields['additional_context'] = {
    type: 'string',
    description: 'Noteworthy remarks, stories, or context beyond direct answers. Capture anything interesting they volunteered.',
  };

  fields['respondent_sentiment'] = {
    type: 'string',
    description: 'Overall mood: positive, neutral, negative, or mixed. One sentence why.',
  };

  fields['survey_completed'] = {
    type: 'boolean',
    description: 'True if they answered all required questions. False if they left early.',
  };

  return fields;
}

// ── Main builder ──

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George — warm, natural

export function buildAgentConfig(
  survey: Survey,
  voiceId: string = DEFAULT_VOICE_ID
): ElevenLabsAgentConfig {
  return {
    name: `Survey: ${survey.title || 'Untitled'}`.slice(0, 100),
    conversation_config: {
      agent: {
        first_message: buildFirstMessage(survey),
        language: 'en',
        prompt: {
          prompt: buildSystemPrompt(survey),
          llm: 'gemini-2.0-flash',
          temperature: 0.7,
        },
      },
      tts: {
        model_id: 'eleven_turbo_v2',
        voice_id: voiceId,
        stability: 0.45,
        similarity_boost: 0.75,
        speed: 1.0,
        optimize_streaming_latency: 0,
      },
      turn: {
        turn_timeout: 8,
        silence_end_call_timeout: 45,
        soft_timeout_config: {
          timeout_seconds: 3.0,
          message: 'Mhmm...',
          use_llm_generated_message: false,
        },
        turn_eagerness: 'normal',
      },
      conversation: {
        max_duration_seconds: 300,
        client_events: [
          'conversation_initiation_metadata',
          'agent_response',
          'user_transcript',
        ],
      },
    },
    platform_settings: {
      data_collection: buildDataCollection(survey.elements),
      evaluation_criteria: {
        survey_completion: {
          description: 'Did the guest answer all required questions?',
        },
        respondent_engagement: {
          description: 'Was the guest engaged and giving real answers, or rushing?',
        },
      },
    },
  };
}

/**
 * Convert ElevenLabs Data Collection results back into a SurveyResponseData.answers map.
 */
export function dataCollectionToAnswers(
  results: Record<string, { value: string | boolean | number | null }>
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  for (const [key, result] of Object.entries(results)) {
    // Skip metadata fields
    if (['respondent_name', 'survey_completed', 'respondent_sentiment', 'additional_context'].includes(key)) continue;

    if (result.value === null || result.value === '') continue;

    // For checkboxes (comma-separated string → array)
    if (typeof result.value === 'string' && result.value.includes(', ')) {
      answers[key] = result.value.split(', ').map((s) => s.trim());
    } else {
      answers[key] = result.value;
    }
  }

  return answers;
}
