// One-shot migration: bring every already-deployed ElevenLabs agent
// up to the configuration Stream B's merge just landed.
//
// Applies two changes per agent:
//   1. client_events gains 'audio', 'interruption', 'ping' — without
//      'audio' the agent is silent on web/WebSocket respondents.
//   2. Prepends an "Output format — CRITICAL" block to the system
//      prompt telling the LLM not to emit bracketed/parenthetical/
//      asterisked stage directions (eleven_turbo_v2 reads them
//      literally).
//
// Usage:
//   cd /Users/fabian/Desktop/Coding_projects/survai/.worktrees/voice-link
//   node --env-file=.env.local scripts/migrate-live-agents.mjs [--dry-run]
//
// Idempotent: skips agents that already have 'audio' in client_events
// AND the output-format block already in their prompt.

import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry-run');

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!ELEVEN_KEY) {
  console.error('Missing ELEVENLABS_API_KEY');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const OUTPUT_FORMAT_BLOCK = `## Output format — CRITICAL
Your output is spoken aloud verbatim by a text-to-speech voice. The
TTS model does NOT interpret stage directions. Write only the plain
words you want the user to HEAR. Never emit:
- Bracketed annotations: [warmly], [excited], [pauses], [laughs], [whispering]
- Parenthetical cues: (softly), (gently)
- Asterisk actions: *smiles*, *chuckles*
- Emoji or smileys
- Labels like "Agent:" or "Assistant:"
If you write any of these tokens, the TTS will read them out letter-
by-letter and ruin the call. Convey warmth through word choice alone.

`;

const TARGET_EVENTS = [
  'conversation_initiation_metadata',
  'agent_response',
  'user_transcript',
  'audio',
  'interruption',
  'ping',
];

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const { data: surveys, error } = await sb
  .from('surveys')
  .select('id, title, agent_id')
  .eq('published', true)
  .not('agent_id', 'is', null);

if (error) {
  console.error('Supabase query failed:', error);
  process.exit(1);
}

console.log(`${DRY ? '[DRY-RUN] ' : ''}Found ${surveys.length} published surveys with an agent_id`);

let patched = 0;
let skipped = 0;
let failed = 0;

for (const s of surveys) {
  const agentId = s.agent_id;
  try {
    const cur = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      headers: { 'xi-api-key': ELEVEN_KEY },
    }).then((r) => r.json());

    const curEvents = cur?.conversation_config?.conversation?.client_events ?? [];
    const curPrompt = cur?.conversation_config?.agent?.prompt?.prompt ?? '';

    const needsEvents = !curEvents.includes('audio');
    const needsPrompt = !curPrompt.includes('## Output format — CRITICAL');

    if (!needsEvents && !needsPrompt) {
      console.log(`  · SKIP  agent=${agentId} survey="${s.title}" — already migrated`);
      skipped++;
      continue;
    }

    const patch = { conversation_config: {} };
    if (needsEvents) {
      patch.conversation_config.conversation = {
        client_events: Array.from(new Set([...curEvents, ...TARGET_EVENTS])),
      };
    }
    if (needsPrompt) {
      const newPrompt = curPrompt.includes('## Style')
        ? curPrompt.replace('## Style', OUTPUT_FORMAT_BLOCK + '## Style')
        : OUTPUT_FORMAT_BLOCK + curPrompt;
      patch.conversation_config.agent = { prompt: { prompt: newPrompt } };
    }

    if (DRY) {
      console.log(
        `  · DRY   agent=${agentId} survey="${s.title}" — would patch events=${needsEvents} prompt=${needsPrompt}`
      );
      continue;
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const body = await res.text();
      console.log(
        `  ✗ FAIL  agent=${agentId} survey="${s.title}" — HTTP ${res.status} ${body.slice(0, 200)}`
      );
      failed++;
      continue;
    }

    console.log(
      `  ✓ PATCH agent=${agentId} survey="${s.title}" — events=${needsEvents} prompt=${needsPrompt}`
    );
    patched++;
  } catch (e) {
    console.log(`  ✗ ERROR agent=${agentId} — ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

console.log('');
console.log(`Done. patched=${patched} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
