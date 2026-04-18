export const ELEMENT_TYPES = [
  'short_text',
  'long_text',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'linear_scale',
  'nps',
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
  accentColor?: string;
  backgroundColor?: string;
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
  /** 'discrete' renders radio dots (default), 'continuous' renders a slider. */
  mode?: 'discrete' | 'continuous';
}

export interface NpsElement extends BaseElement {
  type: 'nps';
  /** Default: "Not likely" */
  minLabel?: string;
  /** Default: "Very likely" */
  maxLabel?: string;
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
  | NpsElement
  | DateElement
  | FileUploadElement
  | SectionHeaderElement
  | PageBreakElement;

export interface SurveySettings {
  theme: 'default' | 'minimal' | 'bold';
  showProgressBar: boolean;
  shuffleQuestions: boolean;
  confirmationMessage: string;
  backgroundImage?: string;
  backgroundPrompt?: string;
  visualEffect?: 'none' | 'gradient-overlay' | 'particles' | 'glass-morphism' | 'aurora';
  fontFamily?: 'inter' | 'dm-sans' | 'space-grotesk' | 'playfair' | 'jetbrains-mono';
  stylePreset?: 'google-forms' | 'typeform';
  colorMode?: 'light' | 'dark';
  /**
   * Canvas layout mode. 'scroll' renders all questions in a vertical scroll
   * (Google Forms style). 'one-at-a-time' renders one question per screen
   * with next/prev navigation (Typeform style).
   */
  layoutMode?: 'scroll' | 'one-at-a-time';
  /** Hidden survey-level configuration that shapes AI behavior. */
  aiContext?: {
    goal?: string;
    strictness?: 'strict' | 'balanced' | 'open';
  };
}

export const DEFAULT_SETTINGS: SurveySettings = {
  theme: 'default',
  showProgressBar: true,
  shuffleQuestions: false,
  confirmationMessage: 'Thank you for your response!',
  stylePreset: 'google-forms',
  colorMode: 'dark',
  layoutMode: 'scroll',
  aiContext: { strictness: 'balanced' },
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

export type ResponseChannel = 'web_form' | 'web_voice' | 'phone_call';

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, unknown>;
  channel?: ResponseChannel;
  respondentMetadata?: {
    userAgent?: string;
    submittedAt: string;
    phoneNumber?: string;
    conversationId?: string;
    callDuration?: number;
  };
  submittedAt: string;
}

/** Response data for both AI-generated mock responses and real responses. */
export interface SurveyResponseData {
  id: string;
  answers: Record<string, unknown>;
  submittedAt: string;
  channel?: ResponseChannel;
  respondentMetadata?: Record<string, unknown>;
}

// ── Publishing & Distribution ──

export type DistributionChannel = 'link' | 'email' | 'sms' | 'phone' | 'qr' | 'embed';

export interface PhoneCampaign {
  id: string;
  batchId: string;         // ElevenLabs batch call ID
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  recipientCount: number;
  completedCount: number;
  createdAt: string;
}

export interface PublishConfig {
  agentId?: string;          // ElevenLabs agent ID for voice/phone
  phoneNumberId?: string;    // ElevenLabs phone number ID
  publicUrl?: string;        // Public survey URL
  distributionChannels: DistributionChannel[];
  phoneCampaigns: PhoneCampaign[];
}

export interface ClarifyingQuestion {
  question: string;
  response: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  generationBatchId?: string;
  inputMethod?: 'text' | 'voice';
  clarifyingQuestions?: ClarifyingQuestion[];
  proposals?: Proposal[];
  isError?: boolean;
}

export interface Proposal {
  label: string;
  description?: string;
  elements: SurveyElement[];
  settings: SurveySettings;
  blockMap: Record<string, string>;
}

export interface InsightCard {
  elementId: string;
  blockId: string;
  blockLabel: string;
  elementTitle: string;
  rationale: string;
}

export interface GenerationBatch {
  batchId: string;
  messageId: string;
  timestamp: string;
  elementIds: string[];
  insightCards: InsightCard[];
}
