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
import { CATALOG, getCatalogEntry } from '@/lib/survey/catalog';
import { STYLE_OPTIONS, type SurveyStyle, type ColorMode } from '@/lib/survey/presets';
import { X, Trash2, Sun, Moon } from 'lucide-react';
import type { ElementType, SurveyElement } from '@/types/survey';

/** Element types that can be converted between (excludes layout types and hidden entries). */
const QUESTION_TYPES = CATALOG.filter((c) => c.category !== 'layout' && !c.hidden);

/** Build update fields for changing an element's type, preserving shared fields. */
function buildTypeConversion(source: SurveyElement, targetType: ElementType): Partial<SurveyElement> {
  const updates: Record<string, unknown> = { type: targetType };
  const choiceTypes: ElementType[] = ['multiple_choice', 'checkboxes', 'dropdown'];

  if (choiceTypes.includes(targetType)) {
    const existingOptions = 'options' in source ? (source as { options: string[] }).options : undefined;
    updates.options = existingOptions && existingOptions.length > 0 ? existingOptions : ['Option 1', 'Option 2', 'Option 3'];
  } else {
    updates.options = undefined;
    updates.allowOther = undefined;
  }

  if (targetType === 'linear_scale') {
    const src = source as unknown as Record<string, unknown>;
    updates.min = src.min ?? 1;
    updates.max = src.max ?? 5;
    updates.minLabel = src.minLabel ?? 'Low';
    updates.maxLabel = src.maxLabel ?? 'High';
  } else {
    updates.min = undefined;
    updates.max = undefined;
    updates.minLabel = undefined;
    updates.maxLabel = undefined;
  }

  if (targetType !== 'short_text' && targetType !== 'long_text') {
    updates.placeholder = undefined;
    updates.validation = undefined;
  }

  return updates as Partial<SurveyElement>;
}

interface Props {
  className?: string;
}

export function PropertiesPanel({ className }: Props) {
  const selectedId = useSurveyStore((s) => s.selectedElementId);
  const elements = useSurveyStore((s) => s.survey.elements);
  const updateElement = useSurveyStore((s) => s.updateElement);
  const selectElement = useSurveyStore((s) => s.selectElement);
  const removeElement = useSurveyStore((s) => s.removeElement);
  const survey = useSurveyStore((s) => s.survey);
  const updateSettings = useSurveyStore((s) => s.updateSettings);

  const currentStyle = (survey.settings.stylePreset || 'google-forms') as SurveyStyle;
  const currentColorMode = (survey.settings.colorMode || 'dark') as ColorMode;

  const element = elements.find((el) => el.id === selectedId);

  const stylePickerUI = (
    <div className="p-4 border-b border-border/60 space-y-3">
      <Label className="text-xs font-medium uppercase text-muted-foreground block">Style</Label>
      <div className="grid grid-cols-2 gap-2">
        {STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateSettings({ stylePreset: opt.value })}
            className={cn(
              'px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200',
              currentStyle === opt.value
                ? 'border-primary bg-primary/10 ring-1 ring-primary/50 text-foreground'
                : 'border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Color mode</Label>
        <div className="flex items-center bg-muted/80 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => updateSettings({ colorMode: 'light' })}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              currentColorMode === 'light'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/30'
            )}
          >
            <Sun className="h-3 w-3" />
            Light
          </button>
          <button
            onClick={() => updateSettings({ colorMode: 'dark' })}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              currentColorMode === 'dark'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/30'
            )}
          >
            <Moon className="h-3 w-3" />
            Dark
          </button>
        </div>
      </div>
    </div>
  );

  const aiContext = survey.settings.aiContext;
  const currentStrictness = aiContext?.strictness ?? 'balanced';

  const aiContextSection = (
    <div className="p-4 space-y-4 border-b border-border/60">
      <h3 className="text-sm font-semibold">AI Context</h3>
      <div className="space-y-2">
        <Label className="text-xs">Survey goal (hidden from respondents)</Label>
        <Textarea
          value={aiContext?.goal ?? ''}
          onChange={(e) =>
            updateSettings({ aiContext: { ...aiContext, goal: e.target.value } })
          }
          placeholder="e.g. Understand why B2B SaaS customers churn in the first 90 days"
          rows={3}
          className="text-sm"
          data-ai-context-goal
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Interview strictness</Label>
        <div
          className="flex gap-1 rounded-lg bg-muted/40 p-0.5"
          data-ai-context-strictness
        >
          {(['strict', 'balanced', 'open'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() =>
                updateSettings({ aiContext: { ...aiContext, strictness: level } })
              }
              className={cn(
                'flex-1 text-xs py-1.5 rounded capitalize transition-colors',
                currentStrictness === level
                  ? 'bg-background shadow-sm'
                  : 'hover:bg-background/50'
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (!element) {
    return (
      <div
        data-properties-panel="true"
        className={cn('flex flex-col h-full overflow-y-auto', className)}
      >
        {stylePickerUI}
        {aiContextSection}
        <div className="flex flex-col items-center justify-center text-muted-foreground text-sm p-8 gap-2 flex-1">
          <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center mb-1">
            <X className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-center font-medium text-foreground/60">No element selected</p>
          <p className="text-center text-xs text-muted-foreground/70">Click a question on the canvas to edit its properties</p>
        </div>
      </div>
    );
  }

  const catalogEntry = getCatalogEntry(element.type);
  const Icon = catalogEntry.icon;
  const isLayout = element.type === 'section_header' || element.type === 'page_break';

  function handleTypeChange(newType: ElementType) {
    if (newType === element!.type) return;
    const updates = buildTypeConversion(element!, newType);
    updateElement(element!.id, updates);
  }

  return (
    <div
      data-properties-panel="true"
      className={cn('h-full overflow-y-auto', className)}
    >
      {stylePickerUI}

      <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">{catalogEntry.label}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => selectElement(null)}>
          <X className="h-3.5 w-3.5" />
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

        {/* Answer Type selector */}
        {!isLayout && (
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase text-muted-foreground">Answer Type</Label>
            <select
              value={element.type}
              onChange={(e) => handleTypeChange(e.target.value as ElementType)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              {QUESTION_TYPES.map((entry) => (
                <option key={entry.type} value={entry.type}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Colors */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase text-muted-foreground">Colors</h4>

          {/* Accent color */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Accent</label>
            <div className="flex flex-wrap gap-1.5">
              {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'].map((color) => (
                <button
                  key={color}
                  onClick={() => updateElement(element.id, { accentColor: color })}
                  className="w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: color, outline: element.accentColor === color ? '2px solid white' : 'none', outlineOffset: '2px' }}
                />
              ))}
              <input
                type="color"
                value={element.accentColor || '#6366f1'}
                onChange={(e) => updateElement(element.id, { accentColor: e.target.value })}
                className="w-6 h-6 rounded-full cursor-pointer border border-white/10 bg-transparent"
              />
              {element.accentColor && (
                <button onClick={() => updateElement(element.id, { accentColor: undefined })} className="text-[10px] text-muted-foreground hover:text-foreground self-center ml-1">
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Background color */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Background</label>
            <div className="flex flex-wrap gap-1.5">
              {['#0a0a12', '#0f172a', '#1e1b4b', '#172554', '#14532d', '#422006', '#4c0519', '#1c1917', '#18181b', '#0c0a09'].map((color) => (
                <button
                  key={color}
                  onClick={() => updateElement(element.id, { backgroundColor: color })}
                  className="w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: color, outline: element.backgroundColor === color ? '2px solid white' : 'none', outlineOffset: '2px' }}
                />
              ))}
              <input
                type="color"
                value={element.backgroundColor || '#0a0a12'}
                onChange={(e) => updateElement(element.id, { backgroundColor: e.target.value })}
                className="w-6 h-6 rounded-full cursor-pointer border border-white/10 bg-transparent"
              />
              {element.backgroundColor && (
                <button onClick={() => updateElement(element.id, { backgroundColor: undefined })} className="text-[10px] text-muted-foreground hover:text-foreground self-center ml-1">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase text-muted-foreground">Survey Font</Label>
          <select
            value={survey.settings.fontFamily || 'inter'}
            onChange={(e) => updateSettings({ fontFamily: e.target.value as any })}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="inter">Inter (Default)</option>
            <option value="dm-sans">DM Sans</option>
            <option value="space-grotesk">Space Grotesk</option>
            <option value="playfair">Playfair Display</option>
            <option value="jetbrains-mono">JetBrains Mono</option>
          </select>
        </div>

        {/* Required toggle */}
        {!isLayout && (
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
            if (window.confirm(`Delete "${element.title || 'this question'}"?`)) {
              removeElement(element.id);
              selectElement(null);
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete Question
        </Button>
      </div>
    </div>
  );
}
