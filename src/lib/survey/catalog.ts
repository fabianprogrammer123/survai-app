import { ElementType, SurveyElement } from '@/types/survey';
import { nanoid } from 'nanoid';
import {
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  ChevronDown,
  Sliders,
  Calendar,
  Upload,
  Heading,
  Minus,
  Heart,
  SlidersHorizontal,
  Grid3x3,
  ArrowUpDown,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

export interface CatalogEntry {
  type: ElementType;
  label: string;
  description: string;
  icon: LucideIcon;
  category: 'text' | 'choice' | 'other' | 'layout';
  hidden?: boolean;
  defaultElement: () => SurveyElement;
}

export const CATALOG: CatalogEntry[] = [
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'Single line text input',
    icon: Type,
    category: 'text',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'short_text' as const,
      title: 'Untitled Question',
      required: false,
    }),
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'Paragraph text input',
    icon: AlignLeft,
    category: 'text',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'long_text' as const,
      title: 'Untitled Question',
      required: false,
    }),
  },
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    description: 'Select one option',
    icon: CircleDot,
    category: 'choice',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'multiple_choice' as const,
      title: 'Untitled Question',
      options: ['Option 1', 'Option 2', 'Option 3'],
      required: false,
    }),
  },
  {
    type: 'checkboxes',
    label: 'Checkboxes',
    description: 'Select multiple options',
    icon: CheckSquare,
    category: 'choice',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'checkboxes' as const,
      title: 'Untitled Question',
      options: ['Option 1', 'Option 2', 'Option 3'],
      required: false,
    }),
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    description: 'Dropdown select menu',
    icon: ChevronDown,
    category: 'choice',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'dropdown' as const,
      title: 'Untitled Question',
      options: ['Option 1', 'Option 2', 'Option 3'],
      required: false,
    }),
  },
  {
    type: 'linear_scale',
    label: 'Linear Scale',
    description: 'Numeric rating scale',
    icon: Sliders,
    category: 'other',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'linear_scale' as const,
      title: 'Untitled Question',
      min: 1,
      max: 5,
      minLabel: 'Low',
      maxLabel: 'High',
      mode: 'discrete' as const,
      required: false,
    }),
  },
  {
    type: 'nps',
    label: 'NPS',
    description: 'Net Promoter Score 0-10 with colored zones',
    icon: Heart,
    category: 'other',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'nps' as const,
      title: 'How likely are you to recommend us?',
      description: '',
      required: false,
      minLabel: 'Not likely',
      maxLabel: 'Very likely',
    }),
  },
  {
    type: 'slider',
    label: 'Slider',
    description: 'Numeric slider (e.g. percentage)',
    icon: SlidersHorizontal,
    category: 'other',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'slider' as const,
      title: 'What percentage of your week is spent in meetings?',
      description: '',
      required: false,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    }),
  },
  {
    type: 'matrix_single',
    label: 'Matrix (single choice)',
    description: 'Rate multiple statements on one scale',
    icon: Grid3x3,
    category: 'choice',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'matrix_single' as const,
      title: 'Rate the following',
      description: '',
      required: false,
      rows: ['Statement 1', 'Statement 2', 'Statement 3'],
      columns: ['Poor', 'Fair', 'Good', 'Excellent'],
    }),
  },
  {
    type: 'ranking',
    label: 'Ranking',
    description: 'Drag items to rank by preference',
    icon: ArrowUpDown,
    category: 'choice',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'ranking' as const,
      title: 'Rank these by preference',
      description: '',
      required: false,
      items: ['Option A', 'Option B', 'Option C'],
    }),
  },
  {
    type: 'date',
    label: 'Date',
    description: 'Date picker',
    icon: Calendar,
    category: 'other',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'date' as const,
      title: 'Untitled Question',
      required: false,
    }),
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Upload files',
    hidden: false,
    icon: Upload,
    category: 'other',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'file_upload' as const,
      title: 'Untitled Question',
      required: false,
    }),
  },
  {
    type: 'section_header',
    label: 'Section Header',
    description: 'Section divider with title',
    icon: Heading,
    category: 'layout',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'section_header' as const,
      title: 'Section Title',
      description: 'Section description',
      required: false,
    }),
  },
  {
    type: 'page_break',
    label: 'Page Break',
    description: 'Multi-page separator',
    icon: Minus,
    category: 'layout',
    defaultElement: () => ({
      id: `el_${nanoid(8)}`,
      type: 'page_break' as const,
      title: 'Page Break',
      required: false,
    }),
  },
];

export function getCatalogEntry(type: ElementType): CatalogEntry {
  const entry = CATALOG.find((c) => c.type === type);
  if (!entry) throw new Error(`Unknown element type: ${type}`);
  return entry;
}
