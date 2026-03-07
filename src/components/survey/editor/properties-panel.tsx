'use client';

import { useSurveyStore } from '@/lib/survey/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OptionsEditor } from './options-editor';
import { cn } from '@/lib/utils';
import { getCatalogEntry } from '@/lib/survey/catalog';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props {
  className?: string;
}

export function PropertiesPanel({ className }: Props) {
  const selectedId = useSurveyStore((s) => s.selectedElementId);
  const elements = useSurveyStore((s) => s.survey.elements);
  const updateElement = useSurveyStore((s) => s.updateElement);
  const selectElement = useSurveyStore((s) => s.selectElement);
  const removeElement = useSurveyStore((s) => s.removeElement);

  const element = elements.find((el) => el.id === selectedId);

  if (!element) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground text-sm p-4', className)}>
        <p className="text-center">Select an element to edit its properties</p>
      </div>
    );
  }

  const catalogEntry = getCatalogEntry(element.type);
  const Icon = catalogEntry.icon;

  return (
    <div className={cn('overflow-y-auto', className)}>
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{catalogEntry.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => selectElement(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase text-muted-foreground">Question Title</Label>
          <Input
            value={element.title}
            onChange={(e) => updateElement(element.id, { title: e.target.value })}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase text-muted-foreground">Description</Label>
          <Textarea
            value={element.description || ''}
            onChange={(e) => updateElement(element.id, { description: e.target.value })}
            rows={2}
          />
        </div>

        {/* Required toggle */}
        {element.type !== 'section_header' && element.type !== 'page_break' && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm">Required</Label>
              <Switch
                checked={element.required}
                onCheckedChange={(checked) => updateElement(element.id, { required: checked })}
              />
            </div>
          </>
        )}

        {/* Placeholder for text elements */}
        {(element.type === 'short_text' || element.type === 'long_text') && (
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase text-muted-foreground">Placeholder</Label>
            <Input
              value={(element as any).placeholder || ''}
              onChange={(e) => updateElement(element.id, { placeholder: e.target.value } as any)}
            />
          </div>
        )}

        {/* Options editor for choice elements */}
        {'options' in element && (
          <>
            <Separator />
            <OptionsEditor
              options={(element as any).options}
              onChange={(options) => updateElement(element.id, { options } as any)}
            />
          </>
        )}

        {/* Scale config */}
        {element.type === 'linear_scale' && (
          <>
            <Separator />
            <div className="space-y-4">
              <Label className="text-xs font-medium uppercase text-muted-foreground">Scale Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    value={element.min}
                    onChange={(e) => updateElement(element.id, { min: parseInt(e.target.value) || 0 } as any)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    value={element.max}
                    onChange={(e) => updateElement(element.id, { max: parseInt(e.target.value) || 5 } as any)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Min Label</Label>
                <Input
                  value={element.minLabel || ''}
                  onChange={(e) => updateElement(element.id, { minLabel: e.target.value } as any)}
                  placeholder="e.g. Strongly Disagree"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Max Label</Label>
                <Input
                  value={element.maxLabel || ''}
                  onChange={(e) => updateElement(element.id, { maxLabel: e.target.value } as any)}
                  placeholder="e.g. Strongly Agree"
                />
              </div>
            </div>
          </>
        )}

        {/* Delete button */}
        <Separator />
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            removeElement(element.id);
            selectElement(null);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete Question
        </Button>
      </div>
    </div>
  );
}
