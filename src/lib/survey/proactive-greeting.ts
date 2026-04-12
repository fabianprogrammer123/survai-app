import type { ChatMessage } from '@/types/survey';
import { nanoid } from 'nanoid';

/**
 * Returns the proactive opening assistant message shown when the
 * user lands on a blank survey editor. Kept as a pure function so
 * the copy can be iterated on without touching UI or store code.
 */
export function buildProactiveGreeting(): ChatMessage {
  return {
    id: nanoid(),
    role: 'assistant',
    content:
      "Hey — I'm your survey co-pilot. Tell me what you're trying to learn and who you're asking, and I'll draft the questions. For example: \"customer onboarding feedback for a B2B SaaS, 5 minutes, focused on the first-week experience.\" What are we building?",
    timestamp: new Date().toISOString(),
  };
}
