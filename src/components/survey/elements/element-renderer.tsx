import { SurveyElement } from '@/types/survey';
import { ShortTextRenderer } from './short-text';
import { LongTextRenderer } from './long-text';
import { MultipleChoiceRenderer } from './multiple-choice';
import { CheckboxesRenderer } from './checkboxes';
import { DropdownRenderer } from './dropdown-element';
import { LinearScaleRenderer } from './linear-scale';
import { NpsRenderer } from './nps';
import { SliderRenderer } from './slider';
import { MatrixSingleRenderer } from './matrix-single';
import { LikertRenderer } from './likert';
import { RankingRenderer } from './ranking';
import { DateRenderer } from './date-element';
import { FileUploadRenderer } from './file-upload';
import { SectionHeaderRenderer } from './section-header';
import { PageBreakRenderer } from './page-break';

export type ElementMode = 'editor' | 'preview' | 'response';

interface ElementRendererProps {
  element: SurveyElement;
  mode: ElementMode;
  value?: unknown;
  onChange?: (value: unknown) => void;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

const RENDERERS: Record<string, React.ComponentType<any>> = {
  short_text: ShortTextRenderer,
  long_text: LongTextRenderer,
  multiple_choice: MultipleChoiceRenderer,
  checkboxes: CheckboxesRenderer,
  dropdown: DropdownRenderer,
  linear_scale: LinearScaleRenderer,
  nps: NpsRenderer,
  slider: SliderRenderer,
  matrix_single: MatrixSingleRenderer,
  likert: LikertRenderer,
  ranking: RankingRenderer,
  date: DateRenderer,
  file_upload: FileUploadRenderer,
  section_header: SectionHeaderRenderer,
  page_break: PageBreakRenderer,
};

export function ElementRenderer({ element, mode, value, onChange, onUpdate }: ElementRendererProps) {
  const Renderer = RENDERERS[element.type];
  if (!Renderer) return <div>Unknown element type: {element.type}</div>;
  return <Renderer element={element} mode={mode} value={value} onChange={onChange} onUpdate={onUpdate} />;
}
