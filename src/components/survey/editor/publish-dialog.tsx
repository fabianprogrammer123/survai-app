'use client';

import { useState, useCallback } from 'react';
import { useSurveyStore } from '@/lib/survey/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  Loader2,
  Users,
  Sparkles,
  Link2,
  Phone,
  Mail,
  Mic,
  Copy,
  Check,
  Upload,
  QrCode,
  PhoneCall,
  Plus,
  X,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';

const RESPONDENT_OPTIONS = [10, 25, 50, 100] as const;

type Tab = 'publish' | 'distribute' | 'phone';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublishDialog({ open, onOpenChange }: PublishDialogProps) {
  const [tab, setTab] = useState<Tab>('publish');
  const [count, setCount] = useState<number>(25);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [campaignName, setCampaignName] = useState('');
  const [isCalling, setIsCalling] = useState(false);

  const title = useSurveyStore((s) => s.survey.title);
  const survey = useSurveyStore((s) => s.survey);
  const elements = useSurveyStore((s) => s.survey.elements);
  const isPublished = useSurveyStore((s) => s.isPublished);
  const isGenerating = useSurveyStore((s) => s.isGeneratingResponses);
  const isCreatingAgent = useSurveyStore((s) => s.isCreatingAgent);
  const publishConfig = useSurveyStore((s) => s.publishConfig);

  const setGeneratingResponses = useSurveyStore((s) => s.setGeneratingResponses);
  const setResponses = useSurveyStore((s) => s.setResponses);
  const setPublished = useSurveyStore((s) => s.setPublished);
  const setEditorMode = useSurveyStore((s) => s.setEditorMode);
  const setCreatingAgent = useSurveyStore((s) => s.setCreatingAgent);
  const setPublishConfig = useSurveyStore((s) => s.setPublishConfig);
  const addPhoneCampaign = useSurveyStore((s) => s.addPhoneCampaign);

  const answerableCount = elements.filter(
    (el) => !['section_header', 'page_break', 'file_upload'].includes(el.type)
  ).length;

  const surveyUrl = publishConfig.publicUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${survey.id || nanoid(10)}`;

  // ── Create ElevenLabs Agent ──
  const createVoiceAgent = useCallback(async () => {
    if (publishConfig.agentId) return publishConfig.agentId;

    setCreatingAgent(true);
    setError(null);
    try {
      const res = await fetch('/api/elevenlabs/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create voice agent');
      }

      const data = await res.json();
      setPublishConfig({
        agentId: data.agentId,
        publicUrl: surveyUrl,
      });
      return data.agentId as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create voice agent';
      setError(msg);
      return null;
    } finally {
      setCreatingAgent(false);
    }
  }, [survey, publishConfig.agentId, surveyUrl, setCreatingAgent, setPublishConfig]);

  // ── Mock Publish with AI Responses ──
  async function handleGenerate() {
    setGeneratingResponses(true);
    setError(null);
    try {
      // Create agent in parallel with response generation
      const [agentId] = await Promise.all([
        createVoiceAgent(),
        (async () => {
          const res = await fetch('/api/ai/responses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ elements, count, title }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to generate responses');
          }

          const data = await res.json();
          setResponses(data.responses);
        })(),
      ]);

      // Persist publish state to DB (if survey has an ID from Supabase)
      if (survey.id) {
        try {
          await fetch(`/api/surveys/${survey.id}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: agentId || undefined,
              publicUrl: surveyUrl,
            }),
          });
        } catch {
          // Non-critical: local state still updated even if DB persist fails
          console.warn('Failed to persist publish state to DB');
        }
      }

      setPublished(true);
      setPublishConfig({ publicUrl: surveyUrl });
      onOpenChange(false);
      setEditorMode('results');

      useSurveyStore.getState().addChatMessage({
        id: nanoid(),
        role: 'assistant',
        content: `Survey published with ${count} AI-generated responses${agentId ? ' and voice agent created' : ''}. Switched to Results view — ask me anything about your data.`,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate responses';
      setError(msg);
    } finally {
      setGeneratingResponses(false);
    }
  }

  // ── Copy Link ──
  function handleCopyLink() {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Phone Campaign ──
  function addPhoneField() {
    setPhoneNumbers((prev) => [...prev, '']);
  }

  function removePhoneField(index: number) {
    setPhoneNumbers((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePhoneNumber(index: number, value: string) {
    setPhoneNumbers((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  async function handleStartCampaign() {
    const validNumbers = phoneNumbers.filter((n) => n.trim());
    if (validNumbers.length === 0) {
      setError('Add at least one phone number');
      return;
    }

    setIsCalling(true);
    setError(null);

    try {
      // Ensure agent exists
      let agentId: string | undefined = publishConfig.agentId;
      if (!agentId) {
        const created = await createVoiceAgent();
        if (!created) return;
        agentId = created;
      }

      // For single calls (no batch API phone number needed)
      // In production, this would use batch API with a provisioned phone number
      const campaign: import('@/types/survey').PhoneCampaign = {
        id: `camp_${nanoid(8)}`,
        batchId: '',
        name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        status: 'pending',
        recipientCount: validNumbers.length,
        completedCount: 0,
        createdAt: new Date().toISOString(),
      };

      // If we have a phone number ID, use batch API
      if (publishConfig.phoneNumberId) {
        const res = await fetch('/api/elevenlabs/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: campaign.name,
            agentId,
            phoneNumberId: publishConfig.phoneNumberId,
            recipients: validNumbers.map((n) => ({ phone_number: n.trim() })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to start campaign');
        }

        const data = await res.json();
        campaign.batchId = data.batchId;
        (campaign as { status: string }).status = 'in_progress';
      } else {
        // No phone number configured — show setup instructions
        setError(
          'Phone calling requires a Twilio phone number imported into ElevenLabs. ' +
          'Go to ElevenLabs Dashboard → Phone Numbers → Import your Twilio number.'
        );
        setIsCalling(false);
        return;
      }

      addPhoneCampaign(campaign);
      setPublished(true);

      useSurveyStore.getState().addChatMessage({
        id: nanoid(),
        role: 'assistant',
        content: `Phone campaign "${campaign.name}" started! Calling ${validNumbers.length} recipient${validNumbers.length !== 1 ? 's' : ''}. I'll track responses as they come in.`,
        timestamp: new Date().toISOString(),
      });

      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start campaign';
      setError(msg);
    } finally {
      setIsCalling(false);
    }
  }

  // ── Handle CSV upload for phone numbers ──
  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      // Skip header if present
      const start = lines[0]?.toLowerCase().includes('phone') ? 1 : 0;
      const numbers = lines.slice(start).map((line) => {
        // Take the first column (CSV)
        const col = line.split(',')[0].replace(/['"]/g, '').trim();
        return col;
      }).filter(Boolean);

      setPhoneNumbers(numbers);
    };
    reader.readAsText(file);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'publish', label: 'Publish', icon: <Globe className="h-3.5 w-3.5" /> },
    { id: 'distribute', label: 'Share', icon: <Link2 className="h-3.5 w-3.5" /> },
    { id: 'phone', label: 'Phone', icon: <Phone className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Publish & Distribute
          </DialogTitle>
          <DialogDescription>
            Publish your survey, share links, or launch a phone campaign.
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                tab === t.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Publish Tab ── */}
        {tab === 'publish' && (
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="font-medium text-sm truncate">{title || 'Untitled Survey'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {answerableCount} answerable question{answerableCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                <Users className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                AI-Generated Respondents
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RESPONDENT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    disabled={isGenerating}
                    className={cn(
                      'rounded-lg border py-2 text-sm font-medium transition-all',
                      count === n
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice agent creation note */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-start gap-2">
                <Mic className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Voice Agent Auto-Created</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    An ElevenLabs AI agent will be created to conduct this survey via voice or phone calls.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isCreatingAgent || answerableCount === 0}
              className="w-full"
            >
              {isGenerating || isCreatingAgent ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  {isCreatingAgent ? 'Creating voice agent...' : `Generating ${count} responses...`}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Publish & Generate {count} Responses
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Share Tab ── */}
        {tab === 'distribute' && (
          <div className="space-y-4 py-1">
            {/* Survey Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Survey Link
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={surveyUrl}
                  className="text-xs font-mono bg-muted/30"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Respondents can fill out the survey via web form or start a voice conversation.
              </p>
            </div>

            <Separator />

            {/* Distribution options */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <Link2 className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Copy Link</span>
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(`Survey: ${title || 'Please take our survey'}`);
                  const body = encodeURIComponent(`Hi,\n\nPlease take a moment to complete our survey:\n${surveyUrl}\n\nThank you!`);
                  window.open(`mailto:?subject=${subject}&body=${body}`);
                }}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <Mail className="h-5 w-5 text-blue-400" />
                <span className="text-xs font-medium">Email</span>
              </button>
              <button
                onClick={() => setTab('phone')}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <PhoneCall className="h-5 w-5 text-green-400" />
                <span className="text-xs font-medium">Phone Call</span>
              </button>
              <button
                onClick={() => {
                  // QR code generation using a free API
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(surveyUrl)}`;
                  window.open(qrUrl, '_blank');
                }}
                className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <QrCode className="h-5 w-5 text-purple-400" />
                <span className="text-xs font-medium">QR Code</span>
              </button>
            </div>

            {/* Embed code */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Embed Code</label>
              <div className="relative">
                <pre className="rounded-lg bg-muted/30 border border-border/40 p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto">
{`<iframe
  src="${surveyUrl}?embed=true"
  width="100%" height="700"
  frameborder="0"
  allow="microphone"
></iframe>`}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<iframe src="${surveyUrl}?embed=true" width="100%" height="700" frameborder="0" allow="microphone"></iframe>`
                    );
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Phone Campaign Tab ── */}
        {tab === 'phone' && (
          <div className="space-y-4 py-1">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-start gap-2">
                <PhoneCall className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">AI Phone Survey</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    An AI voice agent will call each number and conduct the survey conversationally.
                    Responses are captured automatically and added to your results.
                  </p>
                </div>
              </div>
            </div>

            {/* Campaign name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Customer Feedback Q1 2026"
                className="text-sm"
              />
            </div>

            {/* Phone numbers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Phone Numbers (E.164)</label>
                <label className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:text-primary/80">
                  <Upload className="h-3 w-3" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {phoneNumbers.map((num, i) => (
                  <div key={i} className="flex gap-1.5">
                    <Input
                      value={num}
                      onChange={(e) => updatePhoneNumber(i, e.target.value)}
                      placeholder="+14155551234"
                      className="text-sm font-mono"
                    />
                    {phoneNumbers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => removePhoneField(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={addPhoneField}
                className="w-full text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Number
              </Button>
            </div>

            {/* Existing campaigns */}
            {publishConfig.phoneCampaigns.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Previous Campaigns</label>
                  {publishConfig.phoneCampaigns.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
                    >
                      <div>
                        <div className="text-xs font-medium">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.recipientCount} recipients
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium',
                          c.status === 'completed' && 'bg-green-500/10 text-green-400',
                          c.status === 'in_progress' && 'bg-blue-500/10 text-blue-400',
                          c.status === 'pending' && 'bg-yellow-500/10 text-yellow-400',
                          c.status === 'failed' && 'bg-red-500/10 text-red-400'
                        )}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Button
              onClick={handleStartCampaign}
              disabled={isCalling || isCreatingAgent || phoneNumbers.filter((n) => n.trim()).length === 0}
              className="w-full"
            >
              {isCalling || isCreatingAgent ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  {isCreatingAgent ? 'Creating voice agent...' : 'Starting campaign...'}
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-1.5" />
                  Start Phone Campaign ({phoneNumbers.filter((n) => n.trim()).length} calls)
                </>
              )}
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
