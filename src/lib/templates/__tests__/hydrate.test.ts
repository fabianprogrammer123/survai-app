import { describe, it, expect } from 'vitest';
import { hydrateBlueprint } from '../hydrate';

describe('hydrateBlueprint', () => {
  it('produces one element per known block and a non-sparse elements array', () => {
    const result = hydrateBlueprint({
      title: 'Test',
      description: 'desc',
      blocks: [{ blockId: 'nps_score' }, { blockId: 'open_feedback' }],
    });

    expect(result.elements).toHaveLength(2);
    // Guard against sparse entries — this is the class of bug we're defending.
    expect(result.elements.every((el) => el != null && typeof el.type === 'string')).toBe(true);
    expect(result.errors).toEqual([]);
    // Each generated id is in the blockMap keyed on itself.
    for (const el of result.elements) {
      expect(result.blockMap[el.id]).toBeTypeOf('string');
    }
  });

  it('skips unknown blockIds and reports them via the errors array', () => {
    const result = hydrateBlueprint({
      title: 'Test',
      description: 'desc',
      blocks: [
        { blockId: 'nps_score' },
        { blockId: 'this_block_does_not_exist' },
      ],
    });

    expect(result.elements).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('this_block_does_not_exist');
  });

});
