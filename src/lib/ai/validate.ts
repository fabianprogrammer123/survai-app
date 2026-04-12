import { SurveyElement, ELEMENT_TYPES } from '@/types/survey';

const validTypes = new Set<string>(ELEMENT_TYPES);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedElements: SurveyElement[];
}

export function validateAgainstCatalog(elements: SurveyElement[]): ValidationResult {
  const errors: string[] = [];
  const sanitized: SurveyElement[] = [];

  for (const el of elements) {
    // Phase 1: Type validation
    if (!validTypes.has(el.type)) {
      errors.push(`Unknown element type "${el.type}" for element ${el.id} — skipped`);
      continue;
    }

    // Phase 2: Constraint validation
    if ('options' in el && Array.isArray(el.options)) {
      if (el.options.length < 2) {
        errors.push(`Element ${el.id} (${el.type}) has fewer than 2 options — padded`);
        while (el.options.length < 2) {
          el.options.push(`Option ${el.options.length + 1}`);
        }
      }
    }

    if (el.type === 'linear_scale') {
      if (el.min >= el.max) {
        errors.push(`Element ${el.id} has invalid scale (min >= max) — reset to 1-5`);
        el.min = 1;
        el.max = 5;
      }
      if (el.max - el.min > 10) {
        errors.push(`Element ${el.id} has scale range > 10 — capped`);
        el.max = el.min + 10;
      }
    }

    // Phase 2b: ID format validation
    if (!el.id || typeof el.id !== 'string') {
      errors.push(`Element missing valid id — generated one`);
      el.id = `el_${Math.random().toString(36).slice(2, 10)}`;
    }

    sanitized.push(el);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedElements: sanitized,
  };
}
