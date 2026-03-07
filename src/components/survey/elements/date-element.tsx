import { DateElement } from '@/types/survey';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';

interface Props {
  element: DateElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
}

export function DateRenderer({ element, mode, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
      <Input
        type="date"
        disabled={mode === 'editor'}
        readOnly={mode === 'preview'}
        value={mode === 'response' ? (value || '') : ''}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-auto"
      />
    </div>
  );
}
