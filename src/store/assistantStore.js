import { create } from 'zustand';

/**
 * Tiny UI store for the assistant panel. Kept separate from the panel so any
 * screen (including the doorway empty states) can open the panel with a
 * pre-filled question without threading props through the tree.
 *
 * The question history itself lives in the panel component, so it is shared for
 * the session and lost on reload — by design, nothing is persisted.
 */
export const useAssistantStore = create((set) => ({
  open: false,
  initialQuestion: null,

  openAssistant: (question = null) =>
    set({
      open: true,
      initialQuestion: typeof question === 'string' && question.trim() ? question : null,
    }),
  closeAssistant: () => set({ open: false, initialQuestion: null }),
  clearInitial: () => set({ initialQuestion: null }),
}));