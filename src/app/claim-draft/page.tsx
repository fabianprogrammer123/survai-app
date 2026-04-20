'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  consumePendingPublish,
  getSurvey,
  markDraftClaimed,
} from '@/lib/survey/local-surveys';

type ClaimState =
  | { kind: 'migrating' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'nothing-to-claim' };

/**
 * /claim-draft — the handoff page between the passwordless login
 * flow and the DB-backed editor. Gated by the proxy (authenticated
 * users only); anon hits get bounced to /login?next=/claim-draft.
 *
 * Flow:
 *   1. Read the pending-publish stash (single-shot).
 *   2. Load the draft from localStorage.
 *   3. POST /api/surveys with the full draft payload (title, desc,
 *      schema, settings) so the new row is immediately publishable.
 *   4. Move the localStorage blob under the `claimed:` prefix and
 *      strip it from the /test dashboard index.
 *   5. Redirect to /survey/<id>/edit?autopublish=1&count=<n>&gen=<0|1>
 *      where the editor's toolbar picks up the flag and fires the
 *      Publish dialog automatically.
 *
 * Anything that fails here surfaces with a Retry or "Start new
 * draft" exit — no silent data loss, no half-migrated state.
 */
export default function ClaimDraftPage() {
  const router = useRouter();
  const [state, setState] = useState<ClaimState>({ kind: 'migrating' });

  // Guard against React 18 Strict-Mode double-invoke consuming the
  // stash twice (second call would find nothing and route to /test).
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const payload = consumePendingPublish();
      if (!payload) {
        setState({ kind: 'nothing-to-claim' });
        // Short pause so a user who lands here accidentally sees the
        // message before the dashboard redirect takes over.
        setTimeout(() => router.replace('/dashboard'), 800);
        return;
      }

      const draft = getSurvey(payload.localSurveyId);
      if (!draft) {
        setState({
          kind: 'error',
          message:
            'We couldn’t find your draft. It may have expired or been cleared from this browser.',
          canRetry: false,
        });
        return;
      }

      try {
        const res = await fetch('/api/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            schema: draft.elements,
            settings: draft.settings,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const message =
            typeof errBody.error === 'string'
              ? errBody.error
              : `Failed to create survey (HTTP ${res.status})`;
          setState({ kind: 'error', message, canRetry: true });
          return;
        }

        const { id } = (await res.json()) as { id: string };
        markDraftClaimed(payload.localSurveyId);

        const params = new URLSearchParams({
          autopublish: '1',
          count: String(payload.count),
          gen: payload.generateResponses ? '1' : '0',
        });
        router.replace(`/survey/${id}/edit?${params.toString()}`);
      } catch (e) {
        setState({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Unexpected error',
          canRetry: true,
        });
      }
    })();
  }, [router]);

  if (state.kind === 'migrating') {
    return (
      <ClaimShell>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Moving your draft into your account…
        </p>
      </ClaimShell>
    );
  }

  if (state.kind === 'nothing-to-claim') {
    return (
      <ClaimShell>
        <p className="text-sm text-muted-foreground">
          Nothing to claim here — taking you to your dashboard.
        </p>
      </ClaimShell>
    );
  }

  return (
    <ClaimShell>
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-foreground font-medium">Couldn’t move your draft</p>
      <p className="text-sm text-muted-foreground max-w-md text-center">{state.message}</p>
      <div className="flex items-center gap-2 pt-2">
        {state.canRetry && (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              // Reset and try again. The pending-publish stash has
              // already been consumed, so retrying requires the user
              // to go back to /test/edit and hit Publish — surface
              // that rather than looping on an empty stash.
              router.replace('/test');
            }}
          >
            Back to drafts
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => router.replace('/test/edit')}>
          Start a new draft
        </Button>
      </div>
    </ClaimShell>
  );
}

function ClaimShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">{children}</div>
    </div>
  );
}
