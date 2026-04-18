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
