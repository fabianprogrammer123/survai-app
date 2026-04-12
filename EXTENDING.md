# Extending the Survai Catalog

How to add a new survey element type. The catalog manifest auto-picks up new types, so the AI will immediately be able to generate them.

## Steps

### 1. Add the TypeScript type

**File: `src/types/survey.ts`**

Add your type to the `ELEMENT_TYPES` array and create the interface:

```typescript
export const ELEMENT_TYPES = [
  // ... existing types
  'rating_stars',
] as const;

export interface RatingStarsElement extends BaseElement {
  type: 'rating_stars';
  maxStars?: number;
}

// Add to the SurveyElement union
export type SurveyElement =
  | ShortTextElement
  // ... existing types
  | RatingStarsElement;
```

### 2. Add the Zod schema

**File: `src/lib/ai/schema.ts`**

```typescript
const ratingStarsSchema = z.object({
  ...baseFields,
  type: z.literal('rating_stars'),
  maxStars: z.number().optional(),
});

// Add to the discriminated union
export const surveyElementSchema = z.discriminatedUnion('type', [
  // ... existing schemas
  ratingStarsSchema,
]);
```

### 3. Add the catalog entry

**File: `src/lib/survey/catalog.ts`**

```typescript
import { Star } from 'lucide-react';

{
  type: 'rating_stars',
  label: 'Star Rating',
  description: 'Rate with stars',
  icon: Star,
  category: 'other',
  defaultElement: () => ({
    id: `el_${nanoid(8)}`,
    type: 'rating_stars' as const,
    title: 'Rate your experience',
    maxStars: 5,
    required: false,
  }),
},
```

### 4. Create the renderer

**File: `src/components/survey/elements/rating-stars.tsx`**

```typescript
'use client';

import { RatingStarsElement } from '@/types/survey';

interface Props {
  element: RatingStarsElement;
  mode: 'editor' | 'preview' | 'response';
  value?: number;
  onChange?: (value: number) => void;
}

export function RatingStars({ element, mode, value, onChange }: Props) {
  const maxStars = element.maxStars || 5;
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxStars }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={mode === 'editor'}
          onClick={() => onChange?.(i + 1)}
          className={`text-2xl ${(value || 0) > i ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
```

### 5. Register the renderer

**File: `src/components/survey/elements/element-renderer.tsx`**

```typescript
import { RatingStars } from './rating-stars';

const RENDERERS: Record<string, React.ComponentType<any>> = {
  // ... existing renderers
  rating_stars: RatingStars,
};
```

### 6. Add properties panel support

**File: `src/components/survey/editor/properties-panel.tsx`**

Add a case for your element type's editable properties.

### 7. Add property spec for the manifest

**File: `src/lib/ai/catalog-manifest.ts`**

```typescript
const typeProperties: Record<string, PropertySpec[]> = {
  // ... existing entries
  rating_stars: [
    { name: 'maxStars', type: 'number', required: false },
  ],
};
```

This ensures the AI knows about the property schema for your new type.
