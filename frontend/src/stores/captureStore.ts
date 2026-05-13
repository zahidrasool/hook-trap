import { create } from "zustand";
import type { WebhookCapture } from "@/types/webhook";

interface CaptureState {
  captures: WebhookCapture[];
  selectedCapture: WebhookCapture | null;
  setCaptures: (captures: WebhookCapture[]) => void;
  addCapture: (capture: WebhookCapture) => void;
  selectCapture: (capture: WebhookCapture | null) => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  captures: [],
  selectedCapture: null,
  setCaptures: (captures) => set({ captures }),
  addCapture: (capture) =>
    set((state) => ({ captures: [capture, ...state.captures] })),
  selectCapture: (capture) => set({ selectedCapture: capture }),
}));
