import { CATALOG } from '@/lib/survey/catalog';
import { ElementType } from '@/types/survey';

export interface PropertySpec {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'string[]';
  required: boolean;
  description?: string;
}

export interface CatalogManifestEntry {
  type: ElementType;
  label: string;
  description: string;
  category: string;
  properties: PropertySpec[];
  constraints?: Record<string, unknown>;
}

const typeProperties: Record<string, PropertySpec[]> = {
  short_text: [{ name: 'placeholder', type: 'string', required: false }],
  long_text: [{ name: 'placeholder', type: 'string', required: false }],
  multiple_choice: [
    { name: 'options', type: 'string[]', required: true, description: 'At least 2 options' },
    { name: 'allowOther', type: 'boolean', required: false },
  ],
  checkboxes: [
    { name: 'options', type: 'string[]', required: true, description: 'At least 2 options' },
    { name: 'allowOther', type: 'boolean', required: false },
  ],
  dropdown: [
    { name: 'options', type: 'string[]', required: true, description: 'At least 2 options' },
  ],
  linear_scale: [
    { name: 'min', type: 'number', required: true },
    { name: 'max', type: 'number', required: true },
    { name: 'minLabel', type: 'string', required: false },
    { name: 'maxLabel', type: 'string', required: false },
    { name: 'mode', type: 'string', required: false, description: "'discrete' or 'continuous' — discrete renders radio dots, continuous renders a slider" },
  ],
  nps: [
    { name: 'minLabel', type: 'string', required: false, description: "Label under 0 (default 'Not likely')" },
    { name: 'maxLabel', type: 'string', required: false, description: "Label under 10 (default 'Very likely')" },
  ],
  slider: [
    { name: 'min', type: 'number', required: true, description: 'Minimum value' },
    { name: 'max', type: 'number', required: true, description: 'Maximum value' },
    { name: 'step', type: 'number', required: false, description: 'Step increment (default 1)' },
    { name: 'unit', type: 'string', required: false, description: "Unit suffix shown next to the value (e.g. '%', '$')" },
    { name: 'minLabel', type: 'string', required: false },
    { name: 'maxLabel', type: 'string', required: false },
  ],
  matrix_single: [
    { name: 'rows', type: 'string[]', required: true, description: 'Statements to evaluate (at least 1)' },
    { name: 'columns', type: 'string[]', required: true, description: 'Rating scale (at least 2)' },
  ],
  ranking: [
    { name: 'items', type: 'string[]', required: true, description: 'Items to rank (at least 2, unique labels)' },
  ],
  date: [],
  file_upload: [
    { name: 'maxFiles', type: 'number', required: false },
    { name: 'acceptedTypes', type: 'string[]', required: false },
  ],
  section_header: [],
  page_break: [],
};

const typeConstraints: Record<string, Record<string, unknown>> = {
  multiple_choice: { minOptions: 2 },
  checkboxes: { minOptions: 2 },
  dropdown: { minOptions: 2 },
  linear_scale: { minRange: 1, maxRange: 10 },
  matrix_single: { minRows: 1, minColumns: 2 },
  ranking: { minItems: 2 },
};

export function buildCatalogManifest(): CatalogManifestEntry[] {
  return CATALOG.filter((entry) => !entry.hidden).map((entry) => ({
    type: entry.type,
    label: entry.label,
    description: entry.description,
    category: entry.category,
    properties: [
      { name: 'id', type: 'string' as const, required: true, description: 'Unique ID in format el_XXXXXXXX' },
      { name: 'title', type: 'string' as const, required: true, description: 'Question title' },
      { name: 'description', type: 'string' as const, required: false, description: 'Helper text' },
      { name: 'required', type: 'boolean' as const, required: true, description: 'Whether answer is required' },
      ...(typeProperties[entry.type] || []),
    ],
    constraints: typeConstraints[entry.type],
  }));
}

export function catalogToPromptString(): string {
  const manifest = buildCatalogManifest();
  return manifest
    .map((entry) => {
      const props = entry.properties
        .map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
        .join(', ');
      const constraints = entry.constraints
        ? ` Constraints: ${JSON.stringify(entry.constraints)}`
        : '';
      return `- **${entry.type}** (${entry.label}): ${entry.description}. Props: { ${props} }${constraints}`;
    })
    .join('\n');
}
