import { describe, it, expect } from 'vitest';
import { aiResponseSchema } from '../schema';

describe('aiResponseSchema', () => {
  it('accepts a well-formed generate response', () => {
    const payload = {
      intent: 'generate',
      message: 'Here is your survey',
      blueprint: {
        title: 'Feedback',
        description: 'Quick feedback',
        blocks: [
          { blockId: 'nps_score' },
          { blockId: 'open_feedback', overrides: { title: 'Anything else?' } },
        ],
      },
    };

    const result = aiResponseSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.intent).toBe('generate');
      expect(result.data.blueprint?.blocks).toHaveLength(2);
    }
  });

  it('rejects a blueprint whose blocks array contains null entries', () => {
    // This is the exact shape suspected of slipping through the hotfix:
    // a null entry that downstream hydration would trip on.
    const payload = {
      intent: 'generate',
      message: 'ok',
      blueprint: {
        title: 't',
        description: 'd',
        blocks: [{ blockId: 'nps_score' }, null, { blockId: 'open_feedback' }],
      },
    };

    const result = aiResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
