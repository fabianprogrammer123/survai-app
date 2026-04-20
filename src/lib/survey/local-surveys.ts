import { nanoid } from 'nanoid';
import { hydrateSurveyTemplate } from '@/lib/templates/hydrate';
import { getSurveyTemplate } from '@/lib/templates/surveys';
import type { Survey, SurveySettings } from '@/types/survey';
import { DEFAULT_SETTINGS } from '@/types/survey';
import { STYLE_PRESETS } from '@/lib/survey/presets';

// ── Types ──────────────────────────────────────────────────

export interface SurveyMeta {
  id: string;
  title: string;
  published: boolean;
  elementCount: number;
  stylePreset?: string;
  colorMode?: string;
  createdAt: string;
  updatedAt: string;
  preview?: {
    questions: { title: string; type: string }[];
  };
}

// ── Keys ───────────────────────────────────────────────────

const INDEX_KEY = 'survai-surveys-index';
const SURVEY_PREFIX = 'survai-survey-';
const LEGACY_KEY = 'survai-test-survey';
const PENDING_PUBLISH_KEY = 'survai-pending-publish';
const CLAIMED_PREFIX = 'survai-claimed-';
const PENDING_PUBLISH_TTL_MS = 24 * 60 * 60 * 1000;

// ── Index CRUD ─────────────────────────────────────────────

export function getAllSurveyMetas(): SurveyMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const metas = JSON.parse(raw) as SurveyMeta[];
    // Sort by most recently updated
    return metas.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

function saveIndex(metas: SurveyMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
}

function upsertMeta(meta: SurveyMeta): void {
  const metas = getAllSurveyMetas();
  const idx = metas.findIndex((m) => m.id === meta.id);
  if (idx >= 0) {
    metas[idx] = meta;
  } else {
    metas.push(meta);
  }
  saveIndex(metas);
}

function removeMeta(id: string): void {
  const metas = getAllSurveyMetas().filter((m) => m.id !== id);
  saveIndex(metas);
}

function surveyToMeta(survey: Survey): SurveyMeta {
  return {
    id: survey.id,
    title: survey.title || 'Untitled Survey',
    published: survey.published,
    elementCount: survey.elements.length,
    stylePreset: survey.settings.stylePreset,
    colorMode: survey.settings.colorMode,
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    preview: {
      questions: survey.elements.slice(0, 3).map((el) => ({
        title: el.title || '',
        type: el.type || 'short_text',
      })),
    },
  };
}

// ── Survey CRUD ────────────────────────────────────────────

export function getSurvey(id: string): Survey | null {
  try {
    const raw = localStorage.getItem(SURVEY_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as Survey;
  } catch {
    return null;
  }
}

export function saveSurvey(survey: Survey): void {
  const now = new Date().toISOString();
  survey.updatedAt = now;
  localStorage.setItem(SURVEY_PREFIX + survey.id, JSON.stringify(survey));
  upsertMeta(surveyToMeta(survey));
}

export function deleteSurvey(id: string): void {
  localStorage.removeItem(SURVEY_PREFIX + id);
  removeMeta(id);
}

export function duplicateSurvey(id: string): Survey | null {
  const original = getSurvey(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const newSurvey: Survey = {
    ...original,
    id: nanoid(10),
    title: `${original.title} (copy)`,
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  saveSurvey(newSurvey);
  return newSurvey;
}

// ── Create from template ───────────────────────────────────

export function createSurveyFromTemplate(
  templateId: string,
  stylePreset: 'google-forms' | 'typeform' = 'google-forms',
  colorMode: 'light' | 'dark' = 'dark'
): Survey {
  const now = new Date().toISOString();
  const id = nanoid(10);

  const preset = STYLE_PRESETS[`${stylePreset}-${colorMode}` as const];
  const settings: SurveySettings = {
    ...DEFAULT_SETTINGS,
    stylePreset,
    colorMode,
    layoutMode: preset.layoutMode,
  };

  // Blank form — empty survey
  if (templateId === 'blank') {
    const survey: Survey = {
      id,
      title: 'Untitled Survey',
      description: '',
      elements: [],
      settings,
      published: false,
      createdAt: now,
      updatedAt: now,
    };
    saveSurvey(survey);
    return survey;
  }

  // Template-based survey
  const template = getSurveyTemplate(templateId);
  if (!template) {
    // Fallback to blank if template not found
    const survey: Survey = {
      id,
      title: 'Untitled Survey',
      description: '',
      elements: [],
      settings,
      published: false,
      createdAt: now,
      updatedAt: now,
    };
    saveSurvey(survey);
    return survey;
  }

  const result = hydrateSurveyTemplate(
    template.blocks,
    template.label,
    template.description
  );

  const survey: Survey = {
    id,
    title: result.title,
    description: result.description,
    elements: result.elements,
    settings: { ...settings, ...result.settings },
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  saveSurvey(survey);
  return survey;
}

// ── Legacy migration ───────────────────────────────────────

export function migrateLegacySurvey(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;

    const legacy = JSON.parse(raw) as Survey;
    // Only migrate if it has content
    if (legacy.elements.length > 0 || legacy.title !== 'Untitled Survey') {
      // Check if already migrated
      const existing = getSurvey(legacy.id);
      if (!existing) {
        // Give it a proper ID if it has the test placeholder
        if (legacy.id === 'test-local') {
          legacy.id = nanoid(10);
        }
        saveSurvey(legacy);
      }
    }
    // Remove legacy key after migration
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Silently fail migration
  }
}

// ── Pending-publish stash ──────────────────────────────────
//
// A tiny one-slot store used by the anonymous publish flow. When an
// unauthenticated user hits "Publish" on a /test/edit draft, we stash
// the intent here, bounce through login, and the /claim-draft page
// picks it back up to migrate the draft into a DB-backed survey.
//
// Shape is intentionally small: it describes WHAT to do after login,
// not the draft itself (that still lives under SURVEY_PREFIX + id).
// TTL is 24h so a user who closes their laptop and comes back the
// next afternoon still gets the same redirect; anything older points
// at a draft they've likely forgotten about.

export interface PendingPublish {
  /** Id of the localStorage draft to claim and publish. */
  localSurveyId: string;
  /** respondentCount, only meaningful if generateResponses is true. */
  count: number;
  generateResponses: boolean;
  /** ms epoch — compared against Date.now() for TTL. */
  createdAt: number;
}

function isValidPendingPublish(p: unknown): p is PendingPublish {
  if (typeof p !== 'object' || p === null) return false;
  const v = p as Partial<PendingPublish>;
  return (
    typeof v.localSurveyId === 'string' &&
    typeof v.count === 'number' &&
    typeof v.generateResponses === 'boolean' &&
    typeof v.createdAt === 'number'
  );
}

export function setPendingPublish(payload: PendingPublish): void {
  try {
    localStorage.setItem(PENDING_PUBLISH_KEY, JSON.stringify(payload));
  } catch {
    // Storage unavailable or quota exceeded. The caller can detect
    // this via hasPendingPublish() returning false after a set.
  }
}

/**
 * Read, delete, and return the pending-publish payload. Returns null
 * when there is nothing to claim, the stash is stale, or the stored
 * JSON is corrupt. Stale / corrupt entries are removed as a side
 * effect so the next call starts from a clean slate.
 */
export function consumePendingPublish(): PendingPublish | null {
  try {
    const raw = localStorage.getItem(PENDING_PUBLISH_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_PUBLISH_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPendingPublish(parsed)) return null;
    if (Date.now() - parsed.createdAt > PENDING_PUBLISH_TTL_MS) return null;
    return parsed;
  } catch {
    try {
      localStorage.removeItem(PENDING_PUBLISH_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function hasPendingPublish(): boolean {
  try {
    const raw = localStorage.getItem(PENDING_PUBLISH_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPendingPublish(parsed)) {
      localStorage.removeItem(PENDING_PUBLISH_KEY);
      return false;
    }
    if (Date.now() - parsed.createdAt > PENDING_PUBLISH_TTL_MS) {
      localStorage.removeItem(PENDING_PUBLISH_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Move a local draft to the `claimed:` prefix after a successful
 * server-side migration. The copy is retained for 24h as a safety net
 * — if the user navigates back and the DB survey failed to load for
 * any reason, a future recovery path could restore from here. The
 * index entry is removed so the /test dashboard no longer lists it.
 */
export function markDraftClaimed(localSurveyId: string): void {
  try {
    const blobKey = SURVEY_PREFIX + localSurveyId;
    const raw = localStorage.getItem(blobKey);
    if (raw) {
      localStorage.setItem(CLAIMED_PREFIX + localSurveyId, raw);
      localStorage.removeItem(blobKey);
    }
    removeMeta(localSurveyId);
  } catch {
    // Best-effort cleanup; claim already succeeded on the server.
  }
}

// ── Utilities ──────────────────────────────────────────────

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
