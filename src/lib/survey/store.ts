import { create } from 'zustand';
import { Survey, SurveyElement, SurveySettings, ChatMessage, GenerationBatch, SurveyResponseData, PublishConfig, PhoneCampaign, DEFAULT_SETTINGS } from '@/types/survey';
import type { A2UIMessage } from '@a2ui-sdk/types/0.8';
import { nanoid } from 'nanoid';
import { arrayMove } from '@dnd-kit/sortable';

/**
 * Drop null/undefined and obviously-malformed entries from an elements array
 * before it enters the store. The AI generation path has been observed to
 * occasionally produce sparse arrays (see memory/project_undefined_elements_rootcause.md);
 * catching it here prevents downstream .type reads from crashing the editor.
 */
function sanitizeElements(elements: unknown): SurveyElement[] {
  if (!Array.isArray(elements)) return [];
  const clean = elements.filter(
    (el): el is SurveyElement =>
      el != null &&
      typeof el === 'object' &&
      'id' in el &&
      'type' in el &&
      typeof (el as SurveyElement).id === 'string' &&
      typeof (el as SurveyElement).type === 'string'
  );
  if (clean.length !== elements.length) {
    console.warn(
      `[survey/store] dropped ${elements.length - clean.length} invalid element(s) during write`
    );
  }
  return clean;
}

interface SurveyEditorState {
  survey: Survey;
  isDirty: boolean;
  selectedElementId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

  /** Maps element IDs to their source block template ID. */
  elementBlockMap: Record<string, string>;

  /** Generation batches linking chat messages to created elements. */
  generationBatches: GenerationBatch[];

  /** Element IDs currently highlighted from chat insight hover. */
  highlightedElementIds: string[];

  /** Chat message ID highlighted from canvas element hover. */
  highlightedMessageId: string | null;

  /** Current editor mode: edit, preview, or results. */
  editorMode: 'editor' | 'preview' | 'results';

  /** Whether TTS auto-play is enabled. */
  voiceEnabled: boolean;

  /** Chat interaction mode: text (type), dictation (voice-to-text), voice (full voice mode). */
  chatMode: 'text' | 'dictation' | 'voice';

  /** Whether elements are being streamed onto the canvas. */
  isStreaming: boolean;
  /** Whether the proactive AI greeting has already been seeded this session. */
  hasSeededProactiveGreeting: boolean;
  /** Element IDs recently added via streaming (for entry animation). */
  recentlyAddedIds: string[];

  // ── Results / Mock-publish state ──
  /** Whether the survey has been mock-published. */
  isPublished: boolean;
  /** AI-generated dummy responses. */
  responses: SurveyResponseData[];
  /** Loading state while dummy responses are being generated. */
  isGeneratingResponses: boolean;
  /** Chat messages for the results AI. */
  resultsChatMessages: ChatMessage[];
  /** Loading state for the results AI chat. */
  isResultsChatLoading: boolean;
  /** Current A2UI message spec from the results AI. */
  a2uiMessages: A2UIMessage[];

  // ── Publishing & Distribution ──
  publishConfig: PublishConfig;
  isCreatingAgent: boolean;

  // ── Voice Interview ──
  /** Active ElevenLabs conversation ID for voice interview. */
  activeConversationId: string | null;
  isVoiceInterviewActive: boolean;

  // Survey mutations
  setSurvey: (survey: Survey) => void;
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  addElement: (element: SurveyElement, index?: number) => void;
  updateElement: (id: string, updates: Partial<SurveyElement>) => void;
  removeElement: (id: string) => void;
  reorderElements: (oldIndex: number, newIndex: number) => void;
  duplicateElement: (id: string) => void;
  replaceElements: (elements: SurveyElement[]) => void;
  updateSettings: (settings: Partial<SurveySettings>) => void;

  /** Where the last selection came from — 'canvas' triggers Properties tab switch. */
  selectionSource: 'canvas' | 'ai' | null;

  // UI mutations
  selectElement: (id: string | null, source?: 'canvas' | 'ai') => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  markProactiveGreetingSeeded: () => void;

  // AI generation
  applyGeneration: (data: {
    survey: { title: string; description: string; elements: SurveyElement[]; settings: SurveySettings };
    blockMap?: Record<string, string>;
  }) => void;

  // Block map
  addBlockMapping: (elementId: string, blockId: string) => void;

  // Generation batches
  addGenerationBatch: (batch: GenerationBatch) => void;

  // Highlight state for insight mapping
  setHighlightedElements: (ids: string[]) => void;
  setHighlightedMessage: (id: string | null) => void;

  // Editor mode
  setEditorMode: (mode: 'editor' | 'preview' | 'results') => void;

  // Voice
  setVoiceEnabled: (enabled: boolean) => void;
  setChatMode: (mode: 'text' | 'dictation' | 'voice') => void;

  // Streaming
  setStreaming: (streaming: boolean) => void;
  addRecentlyAdded: (id: string) => void;
  clearRecentlyAdded: () => void;
  setBlockMap: (map: Record<string, string>) => void;

  // Results / Mock-publish
  setPublished: (published: boolean) => void;
  setResponses: (responses: SurveyResponseData[]) => void;
  setGeneratingResponses: (loading: boolean) => void;
  addResultsChatMessage: (message: ChatMessage) => void;
  setResultsChatLoading: (loading: boolean) => void;
  setA2UIMessages: (messages: A2UIMessage[]) => void;

  // Publishing & Distribution
  setPublishConfig: (config: Partial<PublishConfig>) => void;
  setCreatingAgent: (loading: boolean) => void;
  addPhoneCampaign: (campaign: PhoneCampaign) => void;
  updatePhoneCampaign: (id: string, updates: Partial<PhoneCampaign>) => void;

  // Voice Interview
  setActiveConversationId: (id: string | null) => void;
  setVoiceInterviewActive: (active: boolean) => void;

  // Persistence
  markClean: () => void;
}

const emptySurvey: Survey = {
  id: '',
  title: 'Untitled Survey',
  description: '',
  elements: [],
  settings: DEFAULT_SETTINGS,
  published: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useSurveyStore = create<SurveyEditorState>((set, get) => ({
  survey: emptySurvey,
  isDirty: false,
  selectedElementId: null,
  chatMessages: [],
  isChatLoading: false,
  elementBlockMap: {},
  generationBatches: [],
  highlightedElementIds: [],
  highlightedMessageId: null,
  editorMode: 'editor',
  voiceEnabled: false,
  chatMode: 'text',
  isStreaming: false,
  recentlyAddedIds: [],
  hasSeededProactiveGreeting: false,

  // Results / Mock-publish
  isPublished: false,
  responses: [],
  isGeneratingResponses: false,
  resultsChatMessages: [],
  isResultsChatLoading: false,
  a2uiMessages: [],

  // Publishing & Distribution
  publishConfig: {
    distributionChannels: ['link'],
    phoneCampaigns: [],
  },
  isCreatingAgent: false,

  // Voice Interview
  activeConversationId: null,
  isVoiceInterviewActive: false,

  setSurvey: (survey) =>
    set({
      survey: { ...survey, elements: sanitizeElements(survey.elements) },
      isDirty: false,
      selectedElementId: null,
      elementBlockMap: {},
    }),

  setTitle: (title) =>
    set((state) => ({
      survey: { ...state.survey, title },
      isDirty: true,
    })),

  setDescription: (description) =>
    set((state) => ({
      survey: { ...state.survey, description },
      isDirty: true,
    })),

  addElement: (element, index) =>
    set((state) => {
      if (
        !element ||
        typeof element !== 'object' ||
        typeof element.id !== 'string' ||
        typeof element.type !== 'string'
      ) {
        console.warn('[survey/store] addElement: refusing to add invalid element', element);
        return state;
      }
      const elements = [...state.survey.elements];
      if (index !== undefined) {
        elements.splice(index, 0, element);
      } else {
        elements.push(element);
      }
      return {
        survey: { ...state.survey, elements },
        isDirty: true,
        selectedElementId: element.id,
      };
    }),

  updateElement: (id, updates) =>
    set((state) => ({
      survey: {
        ...state.survey,
        elements: state.survey.elements.map((el) =>
          el.id === id ? ({ ...el, ...updates } as SurveyElement) : el
        ),
      },
      isDirty: true,
    })),

  removeElement: (id) =>
    set((state) => {
      const { [id]: _, ...remainingBlockMap } = state.elementBlockMap;
      return {
        survey: {
          ...state.survey,
          elements: state.survey.elements.filter((el) => el.id !== id),
        },
        isDirty: true,
        selectedElementId:
          state.selectedElementId === id ? null : state.selectedElementId,
        elementBlockMap: remainingBlockMap,
      };
    }),

  reorderElements: (oldIndex, newIndex) =>
    set((state) => ({
      survey: {
        ...state.survey,
        elements: arrayMove(state.survey.elements, oldIndex, newIndex),
      },
      isDirty: true,
    })),

  duplicateElement: (id) =>
    set((state) => {
      const elementIndex = state.survey.elements.findIndex((el) => el.id === id);
      if (elementIndex === -1) return state;
      const original = state.survey.elements[elementIndex];
      const newId = `el_${nanoid(8)}`;
      const duplicate = { ...original, id: newId };
      const elements = [...state.survey.elements];
      elements.splice(elementIndex + 1, 0, duplicate);
      // Copy block mapping for the duplicate
      const blockMap = { ...state.elementBlockMap };
      if (blockMap[id]) blockMap[newId] = blockMap[id];
      return {
        survey: { ...state.survey, elements },
        isDirty: true,
        selectedElementId: newId,
        elementBlockMap: blockMap,
      };
    }),

  replaceElements: (elements) =>
    set((state) => ({
      survey: { ...state.survey, elements: sanitizeElements(elements) },
      isDirty: true,
    })),

  updateSettings: (settings) =>
    set((state) => ({
      survey: {
        ...state.survey,
        settings: { ...state.survey.settings, ...settings },
      },
      isDirty: true,
    })),

  selectionSource: null,

  selectElement: (id, source) => set({ selectedElementId: id, selectionSource: source ?? null }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  setChatLoading: (loading) => set({ isChatLoading: loading }),

  setChatMessages: (messages) => set({ chatMessages: messages }),

  markProactiveGreetingSeeded: () => set({ hasSeededProactiveGreeting: true }),

  // AI generation — apply a complete generated survey
  applyGeneration: (data) =>
    set({
      survey: {
        ...get().survey,
        title: data.survey.title,
        description: data.survey.description,
        elements: sanitizeElements(data.survey.elements),
        settings: data.survey.settings,
      },
      isDirty: true,
      elementBlockMap: data.blockMap || {},
      selectedElementId: null,
    }),

  addBlockMapping: (elementId, blockId) =>
    set((state) => ({
      elementBlockMap: { ...state.elementBlockMap, [elementId]: blockId },
    })),

  addGenerationBatch: (batch) =>
    set((state) => ({
      generationBatches: [...state.generationBatches, batch],
    })),

  setHighlightedElements: (ids) => set({ highlightedElementIds: ids }),

  setHighlightedMessage: (id) => set({ highlightedMessageId: id }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),

  setChatMode: (mode) => set({
    chatMode: mode,
    // Auto-enable TTS for voice mode
    voiceEnabled: mode === 'voice' || mode === 'dictation',
  }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  addRecentlyAdded: (id) =>
    set((state) => ({
      recentlyAddedIds: [...state.recentlyAddedIds, id],
    })),

  clearRecentlyAdded: () => set({ recentlyAddedIds: [] }),

  setBlockMap: (map) => set({ elementBlockMap: map }),

  // Results / Mock-publish
  setPublished: (published) =>
    set((state) => ({
      isPublished: published,
      survey: { ...state.survey, published },
    })),

  setResponses: (responses) => set({ responses }),

  setGeneratingResponses: (loading) => set({ isGeneratingResponses: loading }),

  addResultsChatMessage: (message) =>
    set((state) => ({
      resultsChatMessages: [...state.resultsChatMessages, message],
    })),

  setResultsChatLoading: (loading) => set({ isResultsChatLoading: loading }),

  setA2UIMessages: (messages) => set({ a2uiMessages: messages }),

  // Publishing & Distribution
  setPublishConfig: (config) =>
    set((state) => ({
      publishConfig: { ...state.publishConfig, ...config },
    })),
  setCreatingAgent: (loading) => set({ isCreatingAgent: loading }),
  addPhoneCampaign: (campaign) =>
    set((state) => ({
      publishConfig: {
        ...state.publishConfig,
        phoneCampaigns: [...state.publishConfig.phoneCampaigns, campaign],
      },
    })),
  updatePhoneCampaign: (id, updates) =>
    set((state) => ({
      publishConfig: {
        ...state.publishConfig,
        phoneCampaigns: state.publishConfig.phoneCampaigns.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      },
    })),

  // Voice Interview
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setVoiceInterviewActive: (active) => set({ isVoiceInterviewActive: active }),

  markClean: () => set({ isDirty: false }),
}));
