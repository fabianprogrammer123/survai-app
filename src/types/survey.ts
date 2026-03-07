export const ELEMENT_TYPES = [
  'short_text',
  'long_text',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'date',
  'file_upload',
  'section_header',
  'page_break',
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

interface BaseElement {
  id: string;
  type: ElementType;
  title: string;
  description?: string;
  required: boolean;
}

interface WithOptions {
  options: string[];
  allowOther?: boolean;
}

interface WithScale {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

interface WithValidation {
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

export interface ShortTextElement extends BaseElement, WithValidation {
  type: 'short_text';
  placeholder?: string;
}

export interface LongTextElement extends BaseElement, WithValidation {
  type: 'long_text';
  placeholder?: string;
}

export interface MultipleChoiceElement extends BaseElement, WithOptions {
  type: 'multiple_choice';
}

export interface CheckboxesElement extends BaseElement, WithOptions {
  type: 'checkboxes';
}

export interface DropdownElement extends BaseElement {
  type: 'dropdown';
  options: string[];
}

export interface LinearScaleElement extends BaseElement, WithScale {
  type: 'linear_scale';
}

export interface DateElement extends BaseElement {
  type: 'date';
}

export interface FileUploadElement extends BaseElement {
  type: 'file_upload';
  maxFiles?: number;
  acceptedTypes?: string[];
}

export interface SectionHeaderElement extends BaseElement {
  type: 'section_header';
}

export interface PageBreakElement extends BaseElement {
  type: 'page_break';
}

export type SurveyElement =
  | ShortTextElement
  | LongTextElement
  | MultipleChoiceElement
  | CheckboxesElement
  | DropdownElement
  | LinearScaleElement
  | DateElement
  | FileUploadElement
  | SectionHeaderElement
  | PageBreakElement;

export interface SurveySettings {
  theme: 'default' | 'minimal' | 'bold';
  showProgressBar: boolean;
  shuffleQuestions: boolean;
  confirmationMessage: string;
}

export const DEFAULT_SETTINGS: SurveySettings = {
  theme: 'default',
  showProgressBar: true,
  shuffleQuestions: false,
  confirmationMessage: 'Thank you for your response!',
};

export interface Survey {
  id: string;
  title: string;
  description: string;
  elements: SurveyElement[];
  settings: SurveySettings;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, unknown>;
  respondentMetadata?: {
    userAgent?: string;
    submittedAt: string;
  };
  submittedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
