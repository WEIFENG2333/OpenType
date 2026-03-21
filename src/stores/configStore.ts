import { create } from 'zustand';
import { AppConfig, DEFAULT_CONFIG, DictionaryEntry, HistoryItem } from '../types/config';

interface ConfigStore {
  config: AppConfig;
  loaded: boolean;

  /** Load config from Electron or localStorage */
  load: () => Promise<void>;

  /** Set a single config key */
  set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;

  /** Batch update multiple keys */
  update: (partial: Partial<AppConfig>) => void;

  /** Add a history item and update stats */
  addHistoryItem: (item: HistoryItem) => void;

  /** Clear all history */
  clearHistory: () => void;

  /** Delete a single history item */
  deleteHistoryItem: (id: string) => void;

  /** Add a word to personal dictionary */
  addDictionaryWord: (word: string, source?: 'manual' | 'auto') => void;

  /** Remove a word from personal dictionary */
  removeDictionaryWord: (word: string) => void;
}

function persist(key: string, value: any) {
  if (window.electronAPI) {
    window.electronAPI.setConfig(key as keyof AppConfig, value);
  } else {
    const stored = localStorage.getItem('opentype-config');
    const obj = stored ? JSON.parse(stored) : {};
    obj[key] = value;
    localStorage.setItem('opentype-config', JSON.stringify(obj));
  }
}

// Track listener cleanup functions to prevent double-registration
let ipcCleanups: (() => void)[] = [];

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  loaded: false,

  load: async () => {
    // Clean up previous listeners (prevents double-register on re-load)
    ipcCleanups.forEach(fn => fn());
    ipcCleanups = [];

    try {
      let stored: Partial<AppConfig> = {};
      if (window.electronAPI) {
        stored = await window.electronAPI.getAllConfig();
      } else {
        const raw = localStorage.getItem('opentype-config');
        if (raw) stored = JSON.parse(raw);
      }
      set({ config: { ...DEFAULT_CONFIG, ...stored }, loaded: true });

      // Listen for cross-window history sync
      if (window.electronAPI?.onHistoryUpdated) {
        ipcCleanups.push(
          window.electronAPI.onHistoryUpdated((history) => {
            set((state) => ({ config: { ...state.config, history } }));
          }),
        );
      }

      // Listen for auto-learned dictionary terms from main process
      if (window.electronAPI?.onDictionaryAutoAdded) {
        ipcCleanups.push(
          window.electronAPI.onDictionaryAutoAdded(async () => {
            const dict = await window.electronAPI!.getConfig('personalDictionary');
            if (Array.isArray(dict)) {
              set((state) => ({ config: { ...state.config, personalDictionary: dict } }));
            }
          }),
        );
      }
    } catch (e) {
      console.error('[ConfigStore] load failed:', e);
      set({ loaded: true });
    }
  },

  set: (key, value) => {
    set((state) => {
      persist(key as string, value);
      return { config: { ...state.config, [key]: value } };
    });
  },

  update: (partial) => {
    set((state) => {
      Object.entries(partial).forEach(([k, v]) => persist(k, v));
      return { config: { ...state.config, ...partial } };
    });
  },

  addHistoryItem: (item) => {
    set((state) => {
      if (!state.config.historyEnabled) return state;
      const history = [item, ...state.config.history].slice(0, 500);
      const totalWordsThisWeek = state.config.totalWordsThisWeek + item.wordCount;
      persist('history', history);
      persist('totalWordsThisWeek', totalWordsThisWeek);
      return { config: { ...state.config, history, totalWordsThisWeek } };
    });
  },

  clearHistory: () => {
    set((state) => {
      persist('history', []);
      return { config: { ...state.config, history: [] } };
    });
  },

  deleteHistoryItem: (id: string) => {
    set((state) => {
      const history = state.config.history.filter((h) => h.id !== id);
      persist('history', history);
      return { config: { ...state.config, history } };
    });
  },

  addDictionaryWord: (word: string, source: 'manual' | 'auto' = 'manual') => {
    set((state) => {
      const trimmed = word.trim();
      if (!trimmed || state.config.personalDictionary.some((e) => e.word.toLowerCase() === trimmed.toLowerCase())) return state;
      const entry: DictionaryEntry = { word: trimmed, source, addedAt: Date.now() };
      const dict = [...state.config.personalDictionary, entry];
      persist('personalDictionary', dict);
      return { config: { ...state.config, personalDictionary: dict } };
    });
  },

  removeDictionaryWord: (word: string) => {
    set((state) => {
      const dict = state.config.personalDictionary.filter((e) => e.word !== word);
      persist('personalDictionary', dict);
      return { config: { ...state.config, personalDictionary: dict } };
    });
  },
}));
