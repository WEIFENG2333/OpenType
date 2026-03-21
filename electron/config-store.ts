import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppConfig, DEFAULT_CONFIG } from '../src/types/config';

// ─── Migration logic (exported for testing) ──────────────────────────────────

const OLD_PREFIXES: Record<string, { prefix: string; hasStt: boolean; hasLlm: boolean }> = {
  siliconflow: { prefix: 'siliconflow', hasStt: true, hasLlm: true },
  openrouter:  { prefix: 'openrouter', hasStt: false, hasLlm: true },
  openai:      { prefix: 'openai', hasStt: true, hasLlm: true },
  dashscope:   { prefix: 'dashscope', hasStt: true, hasLlm: false },
  'openai-compatible': { prefix: 'compatible', hasStt: true, hasLlm: true },
};

/**
 * Apply all migrations to a raw config object. Returns { config, changed }.
 * Pure function — no side effects, no file I/O.
 */
export function migrateConfig(raw: any): { config: AppConfig; changed: boolean } {
  const result = { ...DEFAULT_CONFIG, ...raw };
  let changed = false;

  // Migration 1: personalDictionary string[] → DictionaryEntry[]
  if (Array.isArray(result.personalDictionary) && result.personalDictionary.length > 0
      && typeof result.personalDictionary[0] === 'string') {
    result.personalDictionary = result.personalDictionary.map((w: string) => ({
      word: w, source: 'manual', addedAt: Date.now(),
    }));
    changed = true;
  }

  // Migration 2: flat provider fields → providers map
  if (!result.providers || typeof result.providers !== 'object' || Array.isArray(result.providers)) {
    result.providers = { ...DEFAULT_CONFIG.providers };
  }
  for (const [id, info] of Object.entries(OLD_PREFIXES)) {
    const oldKey = result[`${info.prefix}ApiKey`];
    if (oldKey === undefined) continue;
    changed = true;
    const existing = result.providers[id] || DEFAULT_CONFIG.providers[id] || { apiKey: '', baseUrl: '', sttModel: '', llmModel: '' };
    result.providers[id] = {
      apiKey: result[`${info.prefix}ApiKey`] ?? existing.apiKey,
      baseUrl: result[`${info.prefix}BaseUrl`] ?? existing.baseUrl,
      sttModel: info.hasStt ? (result[`${info.prefix}SttModel`] ?? existing.sttModel) : existing.sttModel,
      llmModel: info.hasLlm ? (result[`${info.prefix}LlmModel`] ?? existing.llmModel) : existing.llmModel,
    };
    delete result[`${info.prefix}ApiKey`];
    delete result[`${info.prefix}BaseUrl`];
    if (info.hasStt) delete result[`${info.prefix}SttModel`];
    if (info.hasLlm) delete result[`${info.prefix}LlmModel`];
  }

  return { config: result, changed };
}

// ─── ConfigStore ─────────────────────────────────────────────────────────────

export class ConfigStore {
  private filePath: string;
  private data: AppConfig;

  constructor() {
    const userDir = app?.getPath?.('userData') ?? path.join(process.env.HOME || '.', '.opentype');
    this.filePath = path.join(userDir, 'config.json');
    const { config, changed } = this.load();
    this.data = config;
    if (changed) this.save();
  }

  private load(): { config: AppConfig; changed: boolean } {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        return migrateConfig(raw);
      }
    } catch (e) {
      console.error('[ConfigStore] load error — attempting backup recovery:', e);
      // Try to recover from backup
      const bakPath = this.filePath + '.bak';
      try {
        if (fs.existsSync(bakPath)) {
          const raw = JSON.parse(fs.readFileSync(bakPath, 'utf-8'));
          console.log('[ConfigStore] recovered from backup');
          return migrateConfig(raw);
        }
      } catch (bakErr) {
        console.error('[ConfigStore] backup recovery also failed:', bakErr);
      }
    }
    return { config: { ...DEFAULT_CONFIG }, changed: false };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Write to temp file first, then rename (atomic on most filesystems)
      const tmpPath = this.filePath + '.tmp';
      const json = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      // Backup current config before overwriting
      if (fs.existsSync(this.filePath)) {
        try { fs.copyFileSync(this.filePath, this.filePath + '.bak'); } catch {}
      }
      fs.renameSync(tmpPath, this.filePath);
    } catch (e) {
      console.error('[ConfigStore] save error:', e);
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.data[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.data[key] = value;
    this.save();
  }

  getAll(): AppConfig {
    return { ...this.data };
  }
}
