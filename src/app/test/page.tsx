'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHeader } from '@/components/survey/dashboard/dashboard-header';
import { TemplateRow } from '@/components/survey/dashboard/template-row';
import { SurveyGrid } from '@/components/survey/dashboard/survey-grid';
import { StyleSelectorDialog } from '@/components/survey/dashboard/style-selector-dialog';
import {
  getAllSurveyMetas,
  createSurveyFromTemplate,
  deleteSurvey,
  duplicateSurvey,
  migrateLegacySurvey,
  type SurveyMeta,
} from '@/lib/survey/local-surveys';

export default function TestDashboard() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Style selector dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Load surveys on mount
  useEffect(() => {
    migrateLegacySurvey();
    setSurveys(getAllSurveyMetas());
  }, []);

  const refreshSurveys = useCallback(() => {
    setSurveys(getAllSurveyMetas());
  }, []);

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    setDialogOpen(true);
  }

  function handleStyleConfirm(
    templateId: string,
    stylePreset: 'google-forms' | 'typeform',
    colorMode: 'light' | 'dark'
  ) {
    const survey = createSurveyFromTemplate(templateId, stylePreset, colorMode);
    setDialogOpen(false);
    router.push(`/test/edit?id=${survey.id}`);
  }

  function handleDuplicate(id: string) {
    duplicateSurvey(id);
    refreshSurveys();
  }

  function handleDelete(id: string) {
    deleteSurvey(id);
    refreshSurveys();
  }

  return (
    <div className="min-h-screen bg-background font-survey-inter">
      <DashboardHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {/* Start-a-new-form band — distinct lighter backdrop, similar to Google Forms */}
        <div className="rounded-2xl bg-gradient-to-b from-muted/40 to-muted/10 border border-border/30 mb-8 shadow-sm">
          <TemplateRow
            onTemplateSelect={handleTemplateSelect}
            searchQuery={searchQuery}
          />
        </div>

        {/* Recent forms section */}
        <SurveyGrid
          surveys={surveys}
          searchQuery={searchQuery}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      </main>

      {/* Style Selector Dialog */}
      <StyleSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templateId={selectedTemplateId}
        onConfirm={handleStyleConfirm}
      />
    </div>
  );
}
