import { SurveyForm } from '@/components/survey/response/survey-form';
import { AnonymousSurvey } from '@/components/survey/response/anonymous-survey';
import type { Survey, SurveyElement } from '@/types/survey';
import { notFound } from 'next/navigation';

/**
 * URL-encoded preview share route. The publish dialog base64url-encodes
 * a `{ survey, agentId }` payload into the [data] segment; we decode it
 * server-side and pick a renderer:
 *
 *   - agentId present → AnonymousSurvey in demoMode. Respondents get
 *     the "Answer by voice" / "Answer by typing" CTAs, and voice taps
 *     open an ElevenLabs web conversation against the creator's agent.
 *     After the call ends we jump straight to "Done" (no Supabase row
 *     exists on this route, so the read-back / submit step is skipped —
 *     the conversation itself is still persisted in ElevenLabs).
 *   - agentId missing → plain SurveyForm. This is the fallback for
 *     shares created before the creator clicked Publish (which is what
 *     creates the agent).
 *
 * For persisted responses wired into the creator's dashboard, the
 * authenticated publish flow emits `/s/{id}` instead, which is backed
 * by a real Supabase row.
 */

interface EncodedPayload {
  survey: Survey;
  agentId: string | null;
}

function isSurveyShape(value: unknown): value is Survey {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'title' in v && 'elements' in v && Array.isArray(v.elements);
}

function decodePayload(data: string): EncodedPayload | null {
  try {
    const json = Buffer.from(data, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;

    // Current shape: { survey, agentId }
    if ('survey' in record && isSurveyShape(record.survey)) {
      return {
        survey: record.survey,
        agentId:
          typeof record.agentId === 'string' && record.agentId.length > 0
            ? record.agentId
            : null,
      };
    }

    // Legacy shape: the Survey itself at the root (pre-voice-share URLs).
    if (isSurveyShape(record)) {
      return { survey: record, agentId: null };
    }

    return null;
  } catch {
    return null;
  }
}

export default async function PreviewSurveyPage({
  params,
}: {
  params: Promise<{ data: string }>;
}) {
  const { data } = await params;
  const payload = decodePayload(data);

  if (!payload) {
    notFound();
  }

  const { survey, agentId } = payload;

  // Voice-capable share: render AnonymousSurvey with agent_id populated.
  if (agentId) {
    return (
      <AnonymousSurvey
        demoMode
        survey={{
          id: survey.id || 'preview',
          title: survey.title || 'Quick survey',
          description: survey.description || '',
          schema: (survey.elements as SurveyElement[]) || [],
          settings: (survey.settings as unknown as Record<string, unknown>) || {},
          agent_id: agentId,
        }}
      />
    );
  }

  // No agent — fall back to the plain form so the share link at least
  // shows the questions. The creator needs to click Publish to get an
  // agent and a voice-capable share URL.
  const surveyForForm = {
    id: survey.id || 'preview',
    title: survey.title || 'Untitled Survey',
    description: survey.description || '',
    schema: survey.elements,
    settings: {
      theme: survey.settings?.theme || 'default',
      showProgressBar: survey.settings?.showProgressBar ?? true,
      confirmationMessage:
        survey.settings?.confirmationMessage || 'Thank you for your response!',
    },
  };

  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-8 px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <div
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 sm:px-4 py-2 text-xs text-amber-700 dark:text-amber-400"
          data-preview-notice="true"
        >
          Preview link — publish the survey to enable voice answering.
          Responses on this link aren&apos;t saved to your dashboard.
        </div>
        <SurveyForm survey={surveyForForm} />
      </div>
    </div>
  );
}
