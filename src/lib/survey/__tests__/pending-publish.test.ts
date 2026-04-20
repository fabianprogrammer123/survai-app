import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setPendingPublish,
  consumePendingPublish,
  hasPendingPublish,
  markDraftClaimed,
  type PendingPublish,
} from '../local-surveys';

// Minimal in-memory localStorage shim for the node test environment.
// The production helpers use localStorage directly; we stub it here
// rather than switch vitest to jsdom just for one module.
function installLocalStorage() {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
  return store;
}

function freshPayload(overrides: Partial<PendingPublish> = {}): PendingPublish {
  return {
    localSurveyId: 'local_abc123',
    count: 25,
    generateResponses: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('pending-publish stash lifecycle', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hasPendingPublish returns false on a fresh store', () => {
    expect(hasPendingPublish()).toBe(false);
  });

  it('round-trips a payload through set + consume', () => {
    const payload = freshPayload({ count: 50, generateResponses: true });
    setPendingPublish(payload);

    expect(hasPendingPublish()).toBe(true);

    const roundTripped = consumePendingPublish();
    expect(roundTripped).toEqual(payload);
  });

  it('consumePendingPublish is single-shot — a second call returns null', () => {
    setPendingPublish(freshPayload());

    expect(consumePendingPublish()).not.toBeNull();
    expect(consumePendingPublish()).toBeNull();
    expect(hasPendingPublish()).toBe(false);
  });

  it('stale (>24h) payloads are dropped by both has and consume', () => {
    // Write a payload with a createdAt 25 hours in the past.
    const staleCreatedAt = Date.now() - 25 * 60 * 60 * 1000;
    setPendingPublish(freshPayload({ createdAt: staleCreatedAt }));

    expect(hasPendingPublish()).toBe(false);
    expect(consumePendingPublish()).toBeNull();

    // has() also clears the stale entry so it doesn't haunt the next call
    setPendingPublish(freshPayload({ createdAt: staleCreatedAt }));
    hasPendingPublish();
    expect(localStorage.getItem('survai-pending-publish')).toBeNull();
  });

  it('corrupted payloads are handled gracefully', () => {
    localStorage.setItem('survai-pending-publish', 'not-json{{{');
    expect(hasPendingPublish()).toBe(false);
    expect(consumePendingPublish()).toBeNull();
  });

  it('payloads missing required fields are rejected', () => {
    localStorage.setItem(
      'survai-pending-publish',
      JSON.stringify({ localSurveyId: 'x' /* missing everything else */ })
    );
    expect(hasPendingPublish()).toBe(false);
    expect(consumePendingPublish()).toBeNull();
  });

  it('TTL boundary: exactly 24h is still valid, 24h + 1ms is stale', () => {
    const fixedNow = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    // Exactly on the edge — still valid
    setPendingPublish(freshPayload({ createdAt: fixedNow - 24 * 60 * 60 * 1000 }));
    expect(hasPendingPublish()).toBe(true);
    consumePendingPublish();

    // 1 ms past the edge — stale
    setPendingPublish(freshPayload({ createdAt: fixedNow - 24 * 60 * 60 * 1000 - 1 }));
    expect(hasPendingPublish()).toBe(false);
  });
});

describe('markDraftClaimed', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('moves the draft blob under claimed: prefix and removes the index entry', () => {
    // Seed the draft blob + an index meta so we can observe the move.
    const id = 'local_zzz';
    const blob = JSON.stringify({ id, title: 'Foo', elements: [] });
    localStorage.setItem('survai-survey-' + id, blob);
    localStorage.setItem(
      'survai-surveys-index',
      JSON.stringify([
        { id, title: 'Foo', published: false, elementCount: 0, createdAt: '', updatedAt: '' },
      ])
    );

    markDraftClaimed(id);

    // Original blob is gone, claimed: copy exists.
    expect(localStorage.getItem('survai-survey-' + id)).toBeNull();
    expect(localStorage.getItem('survai-claimed-' + id)).toBe(blob);

    // Index entry removed.
    const idx = JSON.parse(localStorage.getItem('survai-surveys-index')!) as Array<{ id: string }>;
    expect(idx.find((m) => m.id === id)).toBeUndefined();
  });

  it('is a no-op when the draft blob does not exist', () => {
    // Should not throw, should not create a claimed: key.
    markDraftClaimed('nonexistent_id');
    expect(localStorage.getItem('survai-claimed-nonexistent_id')).toBeNull();
  });
});
