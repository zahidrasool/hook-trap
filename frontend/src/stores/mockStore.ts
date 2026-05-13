// Mock store - placeholder for Phase 4
import { create } from "zustand";

interface MockState {
  mocks: any[];
  setMocks: (mocks: any[]) => void;
}

export const useMockStore = create<MockState>((set) => ({
  mocks: [],
  setMocks: (mocks) => set({ mocks }),
}));
