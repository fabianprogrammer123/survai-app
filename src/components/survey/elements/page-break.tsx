import { PageBreakElement, SurveyElement } from '@/types/survey';
import { Separator } from '@/components/ui/separator';
import { ElementMode } from './element-renderer';

interface Props {
  element: PageBreakElement;
  mode: ElementMode;
  onUpdate?: (updates: Partial<SurveyElement>) => void;
}

export function PageBreakRenderer({ element }: Props) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Separator className="flex-1" />
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Page Break
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
