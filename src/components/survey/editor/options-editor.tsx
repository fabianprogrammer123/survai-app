'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';

interface Props {
  options: string[];
  onChange: (options: string[]) => void;
}

export function OptionsEditor({ options, onChange }: Props) {
  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    onChange(next);
  };

  const addOption = () => {
    onChange([...options, `Option ${options.length + 1}`]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium uppercase text-muted-foreground">Options</Label>
      {options.map((option, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
          <Input
            value={option}
            onChange={(e) => updateOption(i, e.target.value)}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeOption(i)}
            disabled={options.length <= 2}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption} className="w-full">
        <Plus className="mr-2 h-3 w-3" /> Add Option
      </Button>
    </div>
  );
}
