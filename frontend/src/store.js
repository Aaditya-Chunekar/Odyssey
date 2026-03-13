import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── App state ──
  phase: 'search',  // 'search' | 'loading' | 'terrain' | 'flying'

  // ── Destination data ──
  destination: null,    // raw input string
  destData: null,       // resolved {name, country, description, bounds, fun_facts, ...}
  terrainData: null,    // {grid, width, height, min_elev, max_elev, bounds}

  // ── UI ──
  language: 'English',
  narration: null,
  loadingStep: '',
  error: null,

  // ── Flight ──
  cameraPosition: { x: 0, y: 50, z: 0 },
  flyMode: false,

  // ── Voice guide ──
  guideConnected: false,
  guideMessages: [],
  isSpeaking: false,

  // ── Actions ──
  setPhase: (phase) => set({ phase }),
  setDestination: (destination) => set({ destination }),
  setDestData: (destData) => set({ destData }),
  setTerrainData: (terrainData) => set({ terrainData }),
  setLanguage: (language) => set({ language }),
  setNarration: (narration) => set({ narration }),
  setLoadingStep: (loadingStep) => set({ loadingStep }),
  setError: (error) => set({ error }),
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),
  setFlyMode: (flyMode) => set({ flyMode }),
  setGuideConnected: (guideConnected) => set({ guideConnected }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),

  addGuideMessage: (msg) => set((s) => ({
    guideMessages: [...s.guideMessages.slice(-19), msg]
  })),

  reset: () => set({
    phase: 'search',
    destination: null,
    destData: null,
    terrainData: null,
    narration: null,
    error: null,
    loadingStep: '',
    flyMode: false,
    guideConnected: false,
    guideMessages: [],
  }),
}))
