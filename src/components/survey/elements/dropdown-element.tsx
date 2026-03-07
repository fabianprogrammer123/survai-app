import { DropdownElement } from '@/types/survey';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ElementMode } from './element-renderer';

interface Props {
  element: DropdownElement;
  mode: ElementMode;
  value?: string;
  onChange?: (value: string) => void;
}

export function DropdownRenderer({ element, mode, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {element.title}
        {element.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {element.description && (
        <p className="text-sm text-muted-foreground">{element.description}</p>
      )}
      <Select
        value={value || ''}
        onValueChange={(v) => { if (v !== null) onChange?.(v); }}
        disabled={mode === 'editor'}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {element.options.map((option, i) => (
            <SelectItem key={i} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
