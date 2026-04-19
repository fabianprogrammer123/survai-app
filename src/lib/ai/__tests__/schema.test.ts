import { describe, it, expect } from 'vitest';
import { aiResponseSchema, uiCommandSchema } from '../schema';

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

describe('uiCommandSchema — type→action alias', () => {
  it('accepts a command emitted with `type` and normalizes it to `action`', () => {
    const result = uiCommandSchema.safeParse({
      type: 'delete_element',
      elementId: 'el_abc',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('delete_element');
      expect(result.data.elementId).toBe('el_abc');
      // Alias is consumed, not mirrored onto the parsed object.
      expect('type' in result.data).toBe(false);
    }
  });

  it('accepts a command already using the canonical `action` field', () => {
    const result = uiCommandSchema.safeParse({
      action: 'move_element',
      elementId: 'el_1',
      toIndex: 2,
    });
    expect(result.success).toBe(true);
  });

  it('still rejects an unknown action value even when emitted via the alias', () => {
    // The alias is a shape fix, not a bypass for typo'd/hallucinated actions.
    const result = uiCommandSchema.safeParse({
      type: 'destroy_element',
      elementId: 'el_abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown action value in the canonical shape too', () => {
    const result = uiCommandSchema.safeParse({
      action: 'destroy_element',
      elementId: 'el_abc',
    });
    expect(result.success).toBe(false);
  });
});

describe('aiResponseSchema — command intent flows through alias', () => {
  it('accepts a command intent whose commands[] use the `type` alias', () => {
    const payload = {
      intent: 'command',
      message: 'Got it — removing the last question.',
      commands: [{ type: 'delete_element', elementId: 'el_last' }],
    };

    const result = aiResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.commands?.[0].action).toBe('delete_element');
    }
  });
});
