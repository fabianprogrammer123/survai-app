import { create } from 'zustand';
import { Survey, SurveyElement, SurveySettings, ChatMessage, DEFAULT_SETTINGS } from '@/types/survey';
import { nanoid } from 'nanoid';
import { arrayMove } from '@dnd-kit/sortable';

interface SurveyEditorState {
  survey: Survey;
  isDirty: boolean;
  selectedElementId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

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

  // UI mutations
  selectElement: (id: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setChatMessages: (messages: ChatMessage[]) => void;

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

  setSurvey: (survey) => set({ survey, isDirty: false, selectedElementId: null }),

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
    set((state) => ({
      survey: {
        ...state.survey,
        elements: state.survey.elements.filter((el) => el.id !== id),
      },
      isDirty: true,
      selectedElementId:
        state.selectedElementId === id ? null : state.selectedElementId,
    })),

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
      const duplicate = { ...original, id: `el_${nanoid(8)}` };
      const elements = [...state.survey.elements];
      elements.splice(elementIndex + 1, 0, duplicate);
      return {
        survey: { ...state.survey, elements },
        isDirty: true,
        selectedElementId: duplicate.id,
      };
    }),

  replaceElements: (elements) =>
    set((state) => ({
      survey: { ...state.survey, elements },
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

  selectElement: (id) => set({ selectedElementId: id }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  setChatLoading: (loading) => set({ isChatLoading: loading }),

  setChatMessages: (messages) => set({ chatMessages: messages }),

  markClean: () => set({ isDirty: false }),
}));
