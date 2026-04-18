/**
 * Scroll the editor-canvas card for a given element id into view and
 * briefly flash a highlight ring. Used when the user clicks a question
 * preview in the chat rail — we want the editor to jump to the matching
 * section so the two views stay in sync.
 *
 * Safe to call on the server (no-op) and safe when the element is not in
 * the DOM yet (e.g. in preview / results mode).
 */
export function scrollToEditorElement(elementId: string): void {
  if (typeof document === 'undefined') return;
  const selector = `[data-element-id="${CSS.escape(elementId)}"]`;
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) return;

  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
