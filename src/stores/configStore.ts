import { create } from 'zustand';
import { AppConfig, DEFAULT_CONFIG, HistoryItem } from '../types/config';

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

  /** Add a word to personal dictionary */
  addDictionaryWord: (word: string) => void;

  /** Remove a word from personal dictionary */
  removeDictionaryWord: (word: string) => void;
}

function persist(key: string, value: any) {
  if (window.electronAPI) {
    window.electronAPI.setConfig(key, value);
  } else {
    const stored = localStorage.getItem('opentype-config');
    const obj = stored ? JSON.parse(stored) : {};
    obj[key] = value;
    localStorage.setItem('opentype-config', JSON.stringify(obj));
  }
}

function persistAll(config: AppConfig) {
  if (window.electronAPI) {
    Object.entries(config).forEach(([k, v]) => {
      window.electronAPI!.setConfig(k, v);
    });
  } else {
    localStorage.setItem('opentype-config', JSON.stringify(config));
  }
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: { ...DEFAULT_CONFIG },
  loaded: false,

  load: async () => {
    try {
      let stored: Partial<AppConfig> = {};
      if (window.electronAPI) {
        stored = await window.electronAPI.getAllConfig();
      } else {
        const raw = localStorage.getItem('opentype-config');
        if (raw) stored = JSON.parse(raw);
      }
      set({ config: { ...DEFAULT_CONFIG, ...stored }, loaded: true });
    } catch (e) {
      console.error('[ConfigStore] load failed:', e);
      set({ loaded: true });
    }
  },

  set: (key, value) => {
    set((state) => {
      const next = { ...state.config, [key]: value };
      persist(key as string, value);
      return { config: next };
    });
  },

  update: (partial) => {
    set((state) => {
      const next = { ...state.config, ...partial };
      Object.entries(partial).forEach(([k, v]) => persist(k, v));
      return { config: next };
    });
  },

  addHistoryItem: (item) => {
    set((state) => {
      if (!state.config.historyEnabled) return state;
      const history = [item, ...state.config.history].slice(0, 500);
      const totalWordsThisWeek = state.config.totalWordsThisWeek + item.wordCount;
      const next = { ...state.config, history, totalWordsThisWeek };
      persist('history', history);
      persist('totalWordsThisWeek', totalWordsThisWeek);
      return { config: next };
    });
  },

  clearHistory: () => {
    set((state) => {
      const next = { ...state.config, history: [] };
      persist('history', []);
      return { config: next };
    });
  },

  addDictionaryWord: (word: string) => {
    set((state) => {
      const trimmed = word.trim();
      if (!trimmed || state.config.personalDictionary.includes(trimmed)) return state;
      const dict = [...state.config.personalDictionary, trimmed];
      const next = { ...state.config, personalDictionary: dict };
      persist('personalDictionary', dict);
      return { config: next };
    });
  },

  removeDictionaryWord: (word: string) => {
    set((state) => {
      const dict = state.config.personalDictionary.filter((w) => w !== word);
      const next = { ...state.config, personalDictionary: dict };
      persist('personalDictionary', dict);
      return { config: next };
    });
  },
}));
