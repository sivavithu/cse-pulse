import { create } from "zustand";

interface UiStore {
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  toggleChat: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  fallbackActive: boolean;
  setFallbackActive: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  chatOpen: false,
  setChatOpen: (v) => set({ chatOpen: v }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  fallbackActive: false,
  setFallbackActive: (v) => set({ fallbackActive: v }),
}));
