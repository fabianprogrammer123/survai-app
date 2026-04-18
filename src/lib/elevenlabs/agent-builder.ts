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

    case 'nps':
      return `${num}. "${el.title}"${req} — rate on a scale of 0 to 10${el.minLabel ? ` (0 = ${el.minLabel}` : ''}${el.maxLabel ? `, 10 = ${el.maxLabel})` : ')'}`;

    case 'slider':
      return `${num}. "${el.title}"${req} — a number from ${el.min} to ${el.max}${el.unit ? ` ${el.unit}` : ''}${el.minLabel ? ` (${el.min} = ${el.minLabel}` : ''}${el.maxLabel ? `, ${el.max} = ${el.maxLabel})` : ')'}`;

    case 'matrix_single':
      return `${num}. "${el.title}"${req} — ask ONE BY ONE, for each row, they pick ONE from the options. Rows: ${el.rows.map((r) => `"${r}"`).join(', ')}. Options: ${el.columns.join(', ')}.`;

    case 'matrix_multi':
      return `${num}. "${el.title}"${req} — ask ONE BY ONE, for each row, they pick ANY that apply. Rows: ${el.rows.map((r) => `"${r}"`).join(', ')}. Options: ${el.columns.join(', ')}.`;

    case 'likert':
      return `${num}. "${el.title}"${req} — ${el.scale}-point agreement scale (1 = strongly disagree, ${el.scale} = strongly agree). Ask each row one by one: ${el.rows.map((r) => `"${r}"`).join(', ')}.`;

    case 'ranking':
      return `${num}. "${el.title}"${req} — they put these in order, most to least: ${el.items.join(', ')}. All ${el.items.length} items must be ranked.`;

    case 'image_choice':
      return `${num}. "${el.title}"${req} — ${el.multiSelect ? 'pick any' : 'pick one'} of: ${el.options.map((o) => o.label).join(', ')}. (Images aren't visible on voice — read out the labels.)`;

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

      case 'nps':
        fields[el.id] = {
          type: 'number',
          description: `NPS rating for: "${el.title}". Whole number 0 to 10.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'slider':
        fields[el.id] = {
          type: 'number',
          description: `Numeric value for: "${el.title}". Number from ${el.min} to ${el.max}${el.unit ? ` ${el.unit}` : ''}.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'matrix_single':
        el.rows.forEach((rowText, i) => {
          fields[`${el.id}__row${i}`] = {
            type: 'string',
            description: `For "${el.title}" → row "${rowText}": one of ${el.columns.join(', ')}.`,
          };
        });
        break;

      case 'matrix_multi':
        el.rows.forEach((rowText, i) => {
          fields[`${el.id}__row${i}`] = {
            type: 'string',
            description: `For "${el.title}" → row "${rowText}": selections from ${el.columns.join(', ')}, comma-separated.`,
          };
        });
        break;

      case 'likert':
        el.rows.forEach((rowText, i) => {
          fields[`${el.id}__row${i}`] = {
            type: 'number',
            description: `For "${el.title}" → statement "${rowText}": rating 1 (strongly disagree) to ${el.scale} (strongly agree).`,
          };
        });
        break;

      case 'ranking':
        fields[el.id] = {
          type: 'string',
          description: `Ranking for: "${el.title}". Return ALL items from most to least preferred, comma-separated, exactly as labelled: ${el.items.join(', ')}.${el.required ? ' Required.' : ''}`,
        };
        break;

      case 'image_choice':
        fields[el.id] = {
          type: 'string',
          description: `Choice for: "${el.title}". ${el.multiSelect ? 'Comma-separated selections' : 'One'} from: ${el.options.map((o) => o.label).join(', ')}.${el.required ? ' Required.' : ''}`,
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
 *
 * Handles three output shapes:
 * - Scalar answers → `answers[elementId] = value` (short_text, long_text,
 *   single-choice, linear_scale, nps, slider, date, image_choice, file_upload).
 * - Checkbox / image_choice-multi / ranking → comma-separated string is split
 *   into an array of trimmed strings.
 * - Matrix / likert rows → fields keyed `elementId__row{N}` are regrouped into
 *   a per-element array indexed by row order. Multi-select matrix rows whose
 *   values are themselves comma-separated get split into inner arrays.
 */
export function dataCollectionToAnswers(
  results: Record<string, { value: string | boolean | number | null }>
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  const rowGroups: Record<string, unknown[]> = {};

  const ROW_KEY = /^(.+)__row(\d+)$/;

  for (const [key, result] of Object.entries(results)) {
    // Skip metadata fields
    if (['respondent_name', 'survey_completed', 'respondent_sentiment', 'additional_context'].includes(key)) continue;
    if (result.value === null || result.value === '') continue;

    // Matrix / likert row field: elementId__row{N}
    const rowMatch = key.match(ROW_KEY);
    if (rowMatch) {
      const [, elId, idxStr] = rowMatch;
      const idx = parseInt(idxStr, 10);
      const bucket = (rowGroups[elId] ||= []);
      // matrix_multi rows come back as comma-separated; split them so the
      // frontend sees an array per row. Likert/matrix_single stay scalar.
      const rowValue =
        typeof result.value === 'string' && result.value.includes(',')
          ? result.value.split(',').map((s) => s.trim()).filter(Boolean)
          : result.value;
      bucket[idx] = rowValue;
      continue;
    }

    // Checkboxes, ranking, image_choice-multi → comma-separated → array
    if (typeof result.value === 'string' && result.value.includes(',')) {
      answers[key] = result.value.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      answers[key] = result.value;
    }
  }

  // Attach grouped matrix/likert answers.
  for (const [elId, rowArr] of Object.entries(rowGroups)) {
    answers[elId] = rowArr;
  }

  return answers;
}
