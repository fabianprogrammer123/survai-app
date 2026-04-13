'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StylePreset = 'google-forms' | 'typeform';
type ColorMode = 'light' | 'dark';

const STYLE_CARDS: { value: StylePreset; label: string; accent: string; description: string }[] = [
  {
    value: 'google-forms',
    label: 'Google Forms',
    accent: '#673ab7',
    description: 'Classic structured layout with linear question flow',
  },
  {
    value: 'typeform',
    label: 'Typeform',
    accent: '#e94560',
    description: 'One question at a time with smooth transitions',
  },
];

interface StyleSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  onConfirm: (templateId: string, stylePreset: StylePreset, colorMode: ColorMode) => void;
}

export function StyleSelectorDialog({ open, onOpenChange, templateId, onConfirm }: StyleSelectorDialogProps) {
  const [selectedStyle, setSelectedStyle] = useState<StylePreset>('google-forms');
  const [selectedColorMode, setSelectedColorMode] = useState<ColorMode>('dark');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedStyle('google-forms');
      setSelectedColorMode('dark');
    }
  }, [open]);

  function handleConfirm() {
    if (!templateId) return;
    onConfirm(templateId, selectedStyle, selectedColorMode);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a style</DialogTitle>
        </DialogHeader>

        {/* Style cards */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          {STYLE_CARDS.map((style) => (
            <button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              className={cn(
                'flex flex-col items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200',
                selectedStyle === style.value
                  ? 'ring-2 border-transparent bg-muted/50'
                  : 'border-border/50 hover:border-border hover:bg-muted/20'
              )}
              style={selectedStyle === style.value ? { boxShadow: `0 0 0 2px ${style.accent}` } : undefined}
            >
              {/* Mini form preview */}
              <div className="w-full rounded-lg bg-muted/40 p-3 space-y-2">
                <div className="h-1.5 rounded-full w-[60%]" style={{ background: style.accent }} />
                <div className="h-4 rounded bg-muted/60 w-full" />
                <div className="h-1.5 rounded-full w-[45%]" style={{ background: `${style.accent}40` }} />
                <div className="h-4 rounded bg-muted/60 w-[80%]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{style.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {style.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Color mode toggle */}
        <div className="flex items-center justify-between py-1">
          <Label className="text-sm text-muted-foreground">Color mode</Label>
          <div className="flex items-center bg-muted/80 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setSelectedColorMode('light')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                selectedColorMode === 'light'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/30'
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              onClick={() => setSelectedColorMode('dark')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                selectedColorMode === 'dark'
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/30'
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Create survey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
