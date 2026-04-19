import type { SurveySettings } from '@/types/survey';

/**
 * Preserve UI preferences that the user has explicitly chosen on the canvas
 * (color mode, style preset, layout mode) when merging AI-returned settings
 * from a `generate` or `propose` intent.
 *
 * Rationale: creators pick a theme / style explicitly; having the AI silently
 * flip it back to its defaults on every generation is disorienting. Explicit
 * theme changes still flow through the `command` intent (`update_settings`
 * command), which is routed differently and is not affected by this helper.
 */
export function preserveCanvasUiPreferences<T extends Partial<SurveySettings>>(
  hydrated: T,
  current: SurveySettings | null | undefined
): T {
  if (!current) return hydrated;
  const out = { ...hydrated };
  if (current.colorMode) out.colorMode = current.colorMode;
  if (current.stylePreset) out.stylePreset = current.stylePreset;
  if (current.layoutMode) out.layoutMode = current.layoutMode;
  return out;
}
