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
      "Hi — I'm your survey co-pilot. What do you want to learn, and who are you asking?",
    timestamp: new Date().toISOString(),
  };
}
