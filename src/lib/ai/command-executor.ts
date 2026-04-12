import { useSurveyStore } from '@/lib/survey/store';
import type { UiCommand } from '@/lib/ai/schema';
import type { SurveyElement } from '@/types/survey';

export function executeCommands(commands: UiCommand[]) {
  const store = useSurveyStore.getState();

  for (const cmd of commands) {
    switch (cmd.action) {
      case 'move_element': {
        if (!cmd.elementId || cmd.toIndex == null) break;
        const elements = store.survey.elements;
        const oldIndex = elements.findIndex((el) => el.id === cmd.elementId);
        if (oldIndex !== -1 && cmd.toIndex >= 0 && cmd.toIndex < elements.length) {
          store.reorderElements(oldIndex, cmd.toIndex);
        }
        break;
      }
      case 'update_element':
        if (cmd.elementId && cmd.updates) {
          // Strip null values from nullable optional fields
          const updates: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(cmd.updates)) {
            if (v != null) updates[k] = v;
          }
          if (Object.keys(updates).length > 0) {
            store.updateElement(cmd.elementId, updates as Partial<SurveyElement>);
          }
        }
        break;
      case 'delete_element':
        if (cmd.elementId) store.removeElement(cmd.elementId);
        break;
      case 'duplicate_element':
        if (cmd.elementId) store.duplicateElement(cmd.elementId);
        break;
      case 'update_settings':
        if (cmd.settings) {
          // Strip null values from nullable optional fields
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(cmd.settings)) {
            if (v != null) clean[k] = v;
          }
          if (Object.keys(clean).length > 0) {
            store.updateSettings(clean as Partial<typeof store.survey.settings>);
          }
        }
        break;
      case 'select_element':
        if (cmd.elementId) store.selectElement(cmd.elementId);
        break;
    }
  }
}
