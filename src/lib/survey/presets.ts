export type SurveyStyle = 'google-forms' | 'typeform';
export type ColorMode = 'light' | 'dark';
export type StylePreset = `${SurveyStyle}-${ColorMode}`;

export interface PresetConfig {
  label: string;
  description: string;
  cssVars: Record<string, string>;
  fontFamily: string;
  className?: string;
}

export const STYLE_PRESETS: Record<StylePreset, PresetConfig> = {
  'google-forms-light': {
    label: 'Google Forms',
    description: 'Clean and professional',
    fontFamily: 'inter',
    cssVars: {
      '--sv-bg': '#f0ebf8',
      '--sv-card-bg': '#ffffff',
      '--sv-card-border': 'rgba(0, 0, 0, 0.12)',
      '--sv-accent': '#673ab7',
      '--sv-text': '#202124',
      '--sv-text-secondary': '#5f6368',
      '--sv-radius': '8px',
      '--sv-input-bg': '#ffffff',
      '--sv-input-border': 'rgba(0, 0, 0, 0.2)',
      '--sv-card-shadow': '0 1px 2px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
    },
    className: 'survey-light',
  },
  'google-forms-dark': {
    label: 'Google Forms',
    description: 'Clean and professional',
    fontFamily: 'inter',
    cssVars: {
      '--sv-bg': 'transparent',
      '--sv-card-bg': '#1c1b29',
      '--sv-card-border': 'rgba(255, 255, 255, 0.10)',
      '--sv-accent': '#b39ddb',
      '--sv-text': '#e8e8f0',
      '--sv-text-secondary': '#a8a8be',
      '--sv-radius': '8px',
      '--sv-input-bg': 'rgba(255, 255, 255, 0.06)',
      '--sv-input-border': 'rgba(255, 255, 255, 0.14)',
      '--sv-card-shadow': '0 1px 3px rgba(0,0,0,0.4)',
    },
  },
  'typeform-light': {
    label: 'Typeform',
    description: 'Bold and engaging',
    fontFamily: 'dm-sans',
    cssVars: {
      '--sv-bg': '#f5f3ff',
      '--sv-card-bg': '#ffffff',
      '--sv-card-border': 'rgba(0, 0, 0, 0.06)',
      '--sv-accent': '#e94560',
      '--sv-text': '#1a1a2e',
      '--sv-text-secondary': '#6b7280',
      '--sv-radius': '16px',
      '--sv-input-bg': '#fafafa',
      '--sv-input-border': 'rgba(0, 0, 0, 0.1)',
      '--sv-card-shadow': '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    },
    className: 'survey-light',
  },
  'typeform-dark': {
    label: 'Typeform',
    description: 'Bold and engaging',
    fontFamily: 'dm-sans',
    cssVars: {
      '--sv-bg': 'transparent',
      '--sv-card-bg': '#16213e',
      '--sv-card-border': 'rgba(255, 255, 255, 0.08)',
      '--sv-accent': '#e94560',
      '--sv-text': '#eaeaea',
      '--sv-text-secondary': '#a0a0b8',
      '--sv-radius': '16px',
      '--sv-input-bg': 'rgba(255, 255, 255, 0.06)',
      '--sv-input-border': 'rgba(255, 255, 255, 0.12)',
      '--sv-card-shadow': '0 4px 20px rgba(0,0,0,0.3)',
    },
  },
};

/** Get the display name for a survey style */
export const STYLE_OPTIONS: { value: SurveyStyle; label: string }[] = [
  { value: 'google-forms', label: 'Google Forms' },
  { value: 'typeform', label: 'Typeform' },
];
