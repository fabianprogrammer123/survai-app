import type { ElementType, SurveySettings } from '@/types/survey';

// ---------------------------------------------------------------------------
// Block Templates — individual question patterns the agent references by ID
// ---------------------------------------------------------------------------

export type BlockCategory =
  | 'demographics'
  | 'satisfaction'
  | 'feedback'
  | 'behavioral'
  | 'data'
  | 'layout';

export interface BlockDefaults {
  title: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  allowOther?: boolean;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export interface BlockTemplate {
  blockId: string;
  label: string;
  description: string;
  elementType: ElementType;
  category: BlockCategory;
  tags: string[];
  defaults: BlockDefaults;
}

// ---------------------------------------------------------------------------
// Survey Templates — ordered collections of block references
// ---------------------------------------------------------------------------

export type TemplateCategory =
  | 'customer'
  | 'employee'
  | 'research'
  | 'event'
  | 'product'
  | 'general';

export interface TemplateBlock {
  blockId: string;
  overrides?: Partial<BlockDefaults>;
}

export interface SurveyTemplate {
  templateId: string;
  label: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  estimatedTime: string;
  blocks: TemplateBlock[];
  defaultSettings?: Partial<SurveySettings>;
}
